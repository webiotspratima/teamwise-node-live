const { Op, fn, col, where: whereFn } = require("sequelize");
const { Channel, ChannelMember, ChannelSetting, TeamSetting, User, Team } = require("../models");

// Helper to check channel creation permission
const canCreateChannel = async (type, userId, teamId, userRole) => {
  const setting = await TeamSetting.findOne({ where: { team_id: teamId } });
  if (!setting) {
    return { allowed: false, message: "Team settings not found" };
  }

  const creationLimit = setting.channel_creation_limit_per_user || 20;
  const createdChannels = await Channel.count({
    where: { created_by: userId, team_id: teamId },
  });

  if (createdChannels >= creationLimit) {
    return {
      allowed: false,
      message: `Channel creation limit (${creationLimit}) reached for this user`,
    };
  }

  const permissionField =
    type === "public" ? setting.public_channel_creation_permission : setting.private_channel_creation_permission;

  const allowedIds =
    type === "public"
      ? setting.allowed_public_channel_creator_ids || []
      : setting.allowed_private_channel_creator_ids || [];

  if (permissionField === "all") return { allowed: true };
  if (permissionField === "admin" && userRole === "admin") return { allowed: true };
  if (permissionField === "specified_members" && allowedIds.includes(userId)) return { allowed: true };

  return {
    allowed: false,
    message: `You don't have permission to create a ${type} channel. Contact your team admin.`,
  };
};

exports.getChannelInfo = async (req, res) => {
  try {
    const channelId = req.params.id;

    const channel = await Channel.findByPk(channelId, {
      include: [
        {
          model: ChannelMember,
          as: "members",
          include: [{ model: User, attributes: ["id", "name", "email"] }],
        },
        {
          model: ChannelSetting,
          as: "setting",
          attributes: ["channel_id", "allow_posting", "file_sharing", "allow_mentions"],
        },
      ],
    });

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    res.status(200).json({ channel });
  } catch (err) {
    console.error("Get Channel Info Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.createChannel = async (req, res) => {
  try {
    const io = req.app.get("io");
    const { name, description, type, member_ids = [] } = req.body;
    const created_by = req.user.id;
    const team_id = req.team_id;
    const team_role = req.team_role;

    // Validate permission with message
    const { allowed, message } = await canCreateChannel(type, created_by, team_id, team_role);
    if (!allowed) return res.status(403).json({ message });

    const channel = await Channel.create({
      name,
      description,
      type,
      team_id,
      created_by,
    });

    // Add creator as admin
    await ChannelMember.create({
      channel_id: channel.id,
      user_id: created_by,
      role: "admin",
    });

    await ChannelSetting.create({
      channel_id: channel.id,
      allow_posting: "all",
      file_sharing: "all",
      allow_mentions: "all",
      message_retention_days: 90,
    });

    // Add other members as regular members
    const allMembers = [...new Set(member_ids), created_by];
    const uniqueMembers = [...new Set(member_ids)].filter((id) => id !== created_by);
    for (const id of uniqueMembers) {
      await ChannelMember.findOrCreate({
        where: { channel_id: channel.id, user_id: id },
        defaults: { role: "member" },
      });
    }
    allMembers.forEach((member) => io.to(`user_${member}`).emit("new-channel", channel));

    res.status(201).json({ message: "Channel created successfully", channel });
  } catch (err) {
    console.error("Create Channel Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getChannelsByTeam = async (req, res) => {
  try {
    const channels = await Channel.findAll({
      where: { team_id: req.team_id },
      include: [
        {
          model: ChannelMember,
          as: "members",
          include: [{ model: User, attributes: ["id", "name", "email"] }],
        },
        {
          model: ChannelSetting,
          as: "setting",
          attributes: ["channel_id", "allow_posting", "file_sharing", "allow_mentions"],
        },
      ],
    });

    res.status(200).json({ channels });
  } catch (err) {
    console.error("Get Channels Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type } = req.body;
    const requestingUserId = req.user.id;

    const channel = await Channel.findByPk(id);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    const channelMember = await ChannelMember.findOne({
      where: { channel_id: id, user_id: requestingUserId },
    });

    if (!channelMember || channelMember.role !== "admin") {
      return res.status(403).json({ message: "Only channel admins can update the channel" });
    }

    await channel.update({ name, description, type });

    res.status(200).json({ message: "Channel updated successfully", channel });
  } catch (err) {
    console.error("Update Channel Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.id;

    const channel = await Channel.findByPk(id);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    const channelMember = await ChannelMember.findOne({
      where: { channel_id: id, user_id: requestingUserId },
    });

    if (!channelMember || channelMember.role !== "admin") {
      return res.status(403).json({ message: "Only channel admins can delete this channel" });
    }

    await ChannelMember.destroy({ where: { channel_id: id } });
    await channel.destroy();

    res.status(200).json({ message: "Channel deleted successfully" });
  } catch (err) {
    console.error("Delete Channel Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.addMembersToChannel = async (req, res) => {
  try {
    const { channel_id, members } = req.body;
    const { id: requestingUserId } = req.user;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: "Members array is required" });
    }

    const channel = await Channel.findByPk(channel_id);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    const requester = await ChannelMember.findOne({
      where: { channel_id, user_id: requestingUserId },
    });
    if (!requester) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    // If role-based permission required, uncomment:
    // if (requester.role !== "admin") {
    //   return res.status(403).json({ message: "Only channel admins can add members" });
    // }

    const added = [];
    const skipped = [];

    for (const { user_id, role } of members) {
      const [member, created] = await ChannelMember.findOrCreate({
        where: { channel_id, user_id },
        defaults: { role: role || "member" },
      });

      if (created) {
        added.push({ user_id, role: role || "member" });
      } else {
        skipped.push(user_id);
      }
    }

    res.status(200).json({
      message: "Members processed",
      added,
      skipped,
    });
  } catch (err) {
    console.error("Add Members Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.removeMemberFromChannel = async (req, res) => {
  try {
    const { channel_id, user_id } = req.body;
    const { id: requestingUserId } = req.user;

    const member = await ChannelMember.findOne({ where: { channel_id, user_id } });
    if (!member) return res.status(404).json({ message: "Member not found in channel" });

    const requester = await ChannelMember.findOne({
      where: { channel_id, user_id: requestingUserId },
    });
    if (!requester) {
      return res.status(403).json({ message: "You are not a member of this channel" });
    }

    // If role-based permission required, uncomment:
    // if (requester.role !== "admin") {
    //   return res.status(403).json({ message: "Only channel admins can add members" });
    // }

    // Remove the member
    await ChannelMember.destroy({ where: { channel_id, user_id } });

    // Check if any admin remains
    const adminsLeft = await ChannelMember.count({
      where: {
        channel_id,
        role: "admin",
      },
    });

    if (adminsLeft === 0) {
      // No admin left, promote someone else

      // Get all remaining members
      const remainingMembers = await ChannelMember.findAll({
        where: { channel_id },
        include: [
          {
            model: User,
            attributes: ["id"],
            include: [
              {
                model: TeamMember,
                where: { team_id: req.team_id },
                required: false,
              },
            ],
          },
        ],
      });

      if (remainingMembers.length > 0) {
        // Prioritize team admins
        let newAdmin = remainingMembers.find((m) => m.User.TeamMembers?.some((tm) => tm.role === "admin"));

        // If no team admin found, pick the first member
        if (!newAdmin) newAdmin = remainingMembers[0];

        if (newAdmin) {
          await newAdmin.update({ role: "admin" });
        }
      }
    }

    res.status(200).json({ message: "Member removed from channel" });
  } catch (err) {
    console.error("Remove Member Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.changeMemberRole = async (req, res) => {
  try {
    const { channel_id, user_id, new_role } = req.body;
    const { id: requestingUserId } = req.user;

    if (!["admin", "member"].includes(new_role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const requester = await ChannelMember.findOne({ where: { channel_id, user_id: requestingUserId } });
    if (!requester || requester.role !== "admin") {
      return res.status(403).json({ message: "Only admins can change roles" });
    }

    const member = await ChannelMember.findOne({ where: { channel_id, user_id } });
    if (!member) return res.status(404).json({ message: "Member not found in channel" });

    if (member.role === "admin" && new_role !== "admin") {
      const adminCount = await ChannelMember.count({ where: { channel_id, role: "admin" } });
      if (adminCount <= 1) {
        return res.status(400).json({ message: "Cannot remove the last admin" });
      }
    }

    await member.update({ role: new_role });
    res.status(200).json({ message: "Role updated" });
  } catch (err) {
    console.error("Change Role Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Admin

exports.getAllChannels = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      created_by,
      created_from,
      created_to,
      min_size,
      max_size,
      team_id,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Base where condition
    const where = {};

    // Search Channel name
    if (search) {
      where[Op.or] = [
        whereFn(fn("LOWER", col("Channel.name")), {
          [Op.like]: `%${search.toLowerCase()}%`,
        }),
      ];
    }

    // Filter by creator
    if (created_by) {
      where.created_by = created_by;
    }

    if (team_id) {
      where.team_id = team_id;
    }

    // Filter by date range
    if (created_from || created_to) {
      where.created_at = {};
      if (created_from) where.created_at[Op.gte] = new Date(created_from);
      if (created_to) where.created_at[Op.lte] = new Date(created_to);
    }

    // Fetch channels with creator & settings
    const { rows: channels, count: total } = await Channel.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "name", "email"],
        },
        {
          model: Team,
          as: "team",
          attributes: ["id", "name"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Enrich with channel size and admin(s)
    const enriched = await Promise.all(
      channels.map(async (channel) => {
        const members = await ChannelMember.findAll({
          where: { channel_id: channel.id },
          include: [
            {
              model: User,
              attributes: ["id", "name", "email"],
            },
          ],
        });

        const totalMembers = members.length;

        const admins = members
          .filter((m) => m.role === "admin")
          .map((m) => ({
            id: m.User.id,
            name: m.User.name,
            email: m.User.email,
          }));

        return {
          id: channel.id,
          name: channel.name,
          created_at: channel.created_at,
          created_by: channel.creator
            ? {
                id: channel.creator.id,
                name: channel.creator.name,
                email: channel.creator.email,
              }
            : null,
          total_members: totalMembers,
          team: channel.team
            ? {
                id: channel.team.id,
                name: channel.team.name,
              }
            : null,
          admins,
        };
      })
    );

    // Apply channel size filtering after enrichment
    const filtered = enriched.filter((channel) => {
      if (min_size && channel.total_members < parseInt(min_size)) return false;
      if (max_size && channel.total_members > parseInt(max_size)) return false;
      return true;
    });

    return res.status(200).json({
      total: filtered.length,
      page: parseInt(page),
      limit: parseInt(limit),
      teams: filtered,
    });
  } catch (err) {
    console.error("Error in getAllChannels:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
