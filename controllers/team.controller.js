const bcrypt = require('bcryptjs');
const { Op, fn, col, where: whereFn } = require('sequelize');
const { OTPLog, User, Team, TeamMember, TeamSetting, CustomField } = require('../models');
const { sendMail } = require('../utils/mail');
const { generateToken } = require('../utils/jwt');

// On Borading
exports.createTeam = async (req, res) => {

  const { team_name, email, name, country_code, phone, password } = req.body;

  try {
    // Check if user already exists
    let user = await User.findOne({ where: { email } });

    if (user) {
      return res.status(400).json({ message: 'User already exists. Please log in instead.' });
    }

    const otpLog = await OTPLog.findOne({
      where: {
        email: email.toLowerCase().trim(),
        verified: true
      },
      order: [['created_at', 'DESC']]
    });

    if (!otpLog) {
      return res.status(400).json({ message: 'Account is not verified.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    user = await User.create({
      email: email.toLowerCase().trim(),
      name,
      country_code,
      phone,
      password: hashedPassword,
      email_verified: true
    });

    // Extract domain from email
    const domain = email.split('@')[1];

    // Create the team
    const newTeam = await Team.create({
      name: team_name,
      domain,
      created_by: user.id
    });

    // Add user as admin in the new team
    const teamMember = await TeamMember.create({
      team_id: newTeam.id,
      user_id: user.id,
      role: 'admin',
      display_name: name,
      status: 'active'
    });

    // Add Team Setting
    await TeamSetting.create({
      team_id: newTeam.id,
      require_approval_to_join: true,
      invite_only: true,
      approved_domains: [domain], // optional, can be omitted or included as empty
      block_all_other_domains: false,
      invitation_permission: 'admin',
      email_notifications_enabled: true,
      direct_join_enabled: false,
      members_can_create_channels: true,
      message_retention_days: 90,
      notifications_default: 'all',
      public_channel_creation_permission: 'all',
      private_channel_creation_permission: 'admin',
      channel_creation_limit_per_user: 20,
      file_sharing_access: 'admin',
      file_sharing_type_scope: 'all',
      team_file_upload_limit_mb: 1000,
      member_file_upload_limit_mb: 100,
      timezone: 'UTC',
      visibility: 'public',
    });

    // Generate JWT
    const token = generateToken({ id: user.id, email: user.email });

    return res.status(201).json({
      message: 'Team created successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      team: {
        id: newTeam.id,
        name: newTeam.name,
        domain: newTeam.domain
      },
      teamMember: {
        role: teamMember.role
      }
    });
  } catch (err) {
    console.error('Error in createTeam:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.findTeam = async (req, res) => {
  try {
    const { term, email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    const userId = user ? user.id : null;

    const whereClause = term ? { name: { [Op.like]: `%${term}%` } } : {};

    const teams = await Team.findAll({
      where: whereClause,
      include: [
        {
          model: TeamSetting,
          as: 'team_setting', // or whatever alias you’ve used in association
          where: {
            visibility: 'public'
          },
          required: true // ensures only teams with matching settings are returned
        }
      ]
    });

    let memberRecords = [];

    if (userId) {
      memberRecords = await TeamMember.findAll({
        where: {
          user_id: userId,
          team_id: teams.map((t) => t.id),
        },
      });
    }

    const memberMap = {};
    memberRecords.forEach((m) => {
      memberMap[m.team_id] = m.status; // 'active', 'pending', etc.
    });

    // Wait for all async map operations to resolve
    const result = await Promise.all(
      teams.map(async (team) => {
        const status = memberMap[team.id] || "join";

        const memberCount = await TeamMember.count({
          where: {
            team_id: team.id,
            status: ["active"], // adjust as needed
          },
        });

        return {
          id: team.id,
          name: team.name,
          memberCount,
          status:
            status === "active"
              ? "joined"
              : status === "pending"
              ? "requested"
              : "join",
        };
      })
    );

    return res.status(200).json({ teams: result });
  } catch (err) {
    console.error("Error in findTeam:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.joinTeamPreUser = async (req, res) => {
  const { email, team_id } = req.body;

  try {
    if (!email || !team_id) {
      return res.status(400).json({ message: 'Email and team ID are required' });
    }

    const domain = email.split('@')[1]?.toLowerCase().trim();
    const nameFromEmail = email.split('@')[0]?.toLowerCase().trim();

    if (!domain || !nameFromEmail) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const team = await Team.findByPk(team_id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const setting = await TeamSetting.findOne({ where: { team_id } });
    if (!setting) return res.status(400).json({ message: 'Team settings not found' });

    const {
      invite_only,
      require_approval_to_join,
      approved_domains = [],
      block_all_other_domains,
    } = setting;

    let status;
    const domainApproved = approved_domains.includes(domain);

    if (!invite_only) {
      status = 'active'; // Public team
    } else {
      if (domainApproved) {
        status = 'active';
      } else if (block_all_other_domains) {
        return res.status(403).json({ message: 'Domain not allowed to join this team.' });
      } else {
        status = require_approval_to_join ? 'pending' : 'active';
      }
    }

    // Check if user already exists
    let user = await User.findOne({ where: { email } });

    if (user) {
      const alreadyInTeam = await TeamMember.findOne({
        where: { team_id, user_id: user.id }
      });

      if (alreadyInTeam) {
        return res.status(409).json({ message: 'User is already a member of this team' });
      }
    } else {
      // Create user if not exists
      user = await User.create({
        name: nameFromEmail,
        email,
        password: '',
        role: 'user',
      });
    }

    // Add user to the team
    await TeamMember.create({
      team_id,
      user_id: user.id,
      display_name: nameFromEmail,
      role: 'member',
      status,
    });

    return res.status(200).json({
      message: status === 'active'
        ? 'User joined team successfully.'
        : 'Join request submitted. Awaiting approval.',
      status,
    });

  } catch (err) {
    console.error('Error in joinTeamPreUser:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.setupUserProfile = async (req, res) => {
  try {
    const { email, name, country_code, phone, password } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = {
      name: name ?? user.name,
      country_code,
      phone,
      email_verified: true
    };

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    await user.update(updateData);

    // Generate JWT
    const token = generateToken({ id: user.id, email: user.email });

    // Fetch active teams
    const teamMemberships = await TeamMember.findAll({
      where: {
        user_id: user.id,
        status: 'active'
      }
    });

    const teamCount = teamMemberships.length;
    let teamId = null;
    let teamMemberRole = null;

    if (teamCount === 1) {
      teamId = teamMemberships[0].team_id;
      teamMemberRole = teamMemberships[0].role;
    }

    const fields = await CustomField.findAll({
      where: { team_id: teamId },
    });

    return res.status(200).json({
      message: 'Profile updated successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      showTeamsScreen: teamCount > 1,
      teamId,
      teamMemberRole,
      fields
    });

  } catch (err) {
    console.error('Error in setupUserProfile:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getTeams = async (req, res) => {
  const userId = req.user?.id;

  try {
    // Get all teams where user is a member
    const teamMemberships = await TeamMember.findAll({
      where: { user_id: userId },
      include: {
        model: Team,
        attributes: ['id', 'name']
      }
    });

    if (!teamMemberships || teamMemberships.length === 0) {
      return res.status(404).json({ message: 'No teams found for this user' });
    }

    // Prepare teams with member count
    const teams = await Promise.all(teamMemberships.map(async (membership) => {
      const team = membership.Team;

      const memberCount = await TeamMember.count({
        where: {
          team_id: team.id,
          status: ['active'] // adjust as needed
        }
      });

      const fields = await CustomField.findAll({
        where: { team_id: team.id },
      });

      return {
        id: team.id,
        name: team.name,
        role: membership.role,
        status: membership.status,
        memberCount,
        fields
      };
    }));

    return res.status(200).json({ teams });
  } catch (err) {
    console.error('Error in getTeams:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Team Admin

exports.addNewTeam = async (req, res) => {

  const { team_name } = req.body;

  try {

    // Extract domain from email
    const domain = req.user.email.split('@')[1];

    // Create the team
    const newTeam = await Team.create({
      name: team_name,
      domain,
      created_by: req.user.id
    });

    // Add user as admin in the new team
    const teamMember = await TeamMember.create({
      team_id: newTeam.id,
      user_id: req.user.id,
      role: 'admin',
      display_name: req.user.name,
      status: 'active'
    });

    // Add Team Setting
    await TeamSetting.create({
      team_id: newTeam.id,
      require_approval_to_join: true,
      invite_only: true,
      approved_domains: [domain], // optional, can be omitted or included as empty
      block_all_other_domains: false,
      invitation_permission: 'admin',
      email_notifications_enabled: true,
      direct_join_enabled: false,
      members_can_create_channels: true,
      message_retention_days: 90,
      notifications_default: 'all',
      public_channel_creation_permission: 'all',
      private_channel_creation_permission: 'admin',
      channel_creation_limit_per_user: 20,
      file_sharing_access: 'admin',
      file_sharing_type_scope: 'all',
      team_file_upload_limit_mb: 1000,
      member_file_upload_limit_mb: 100,
      timezone: 'UTC',
      visibility: 'public',
    });

    return res.status(200).json({ team: newTeam });

  } catch(err) {
    console.error('Error in addNewTeam:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.inviteTeamMember = async (req, res) => {
  const { emails } = req.body;
  const inviterId = req.user.id;

  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ message: 'No emails provided' });
  }

  try {
    const team = await Team.findByPk(req.team_id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const inviter = await User.findByPk(inviterId);
    const results = [];

    // Process invitations concurrently
    await Promise.all(
      emails.map(async (email) => {
        const emailTrimmed = email.trim().toLowerCase();
        const nameFromEmail = emailTrimmed.split('@')[0];

        // Basic email format check
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
          results.push({ email: emailTrimmed, error: 'Invalid email format' });
          return;
        }

        // Check if user already exists
        let user = await User.findOne({ where: { email: emailTrimmed } });
        if (!user) {
          user = await User.create({
            name: nameFromEmail,
            email: emailTrimmed,
            password: '',
            role: 'user',
          });
        }

        // Check if already a team member
        const existing = await TeamMember.findOne({
          where: { team_id: req.team_id, user_id: user.id },
        });

        if (existing) {
          results.push({ email: emailTrimmed, error: 'Already a team member' });
          return;
        }

        // Add user to team
        await TeamMember.create({
          team_id: req.team_id,
          user_id: user.id,
          display_name: nameFromEmail,
          role: "member",
          status: "active",
        });

        // Send invitation email
        const subject = `You're invited to join the team "${team.name}"`;
        const html = `
          <p>Hello ${nameFromEmail},</p>
          <p>You’ve been invited by ${inviter.name} to join the team <strong>${team.name}</strong>.</p>
          <p>Please login or register to access the workspace.</p>
        `;
        await sendMail(emailTrimmed, subject, html);

        results.push({ email: emailTrimmed, status: 'invited' });
      })
    );

    return res.status(200).json({
      message: 'Invitations processed',
      results,
    });

  } catch (err) {
    console.error('Error in inviteTeamMember:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateTeamMemberStatus = async (req, res) => {
  const { user_id, action } = req.body; // 'approve', 'reject', 'deactivate', 'reactivate', 'make_admin'

  try {
    const member = await TeamMember.findOne({
      where: {
        team_id: req.team_id,
        user_id: user_id,
      },
    });
    if (!member) return res.status(404).json({ message: "Member not found" });

    if (member && member.user_id == req.user.id){
      return res.status(403).json({ message: "Not authorized" });
    }

    // Define new status based on action
    const statusMap = {
      approve: "active",
      reject: "rejected",
      deactivate: "deactivated",
      reactivate: "active",
    };

    let updateData = {};

    if (action === "make_admin") {
      updateData.role = "admin";
    } else if (action === "remove_admin") {
      updateData.role = "member";
    } else if (statusMap[action]) {
      updateData.status = statusMap[action];
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await member.update(updateData);

    res.status(200).json({ message: "Member updated", data: member });

  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateTeam = async (req, res) => {
  const { team_name } = req.body;
  try {

    const team = await Team.findOne({ where: { id: req.team_id } });
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const avatar = req.file ? `/uploads/team_avatars/${req.file.filename}` : team.avatar;

    await team.update({
      name: team_name ?? team.name,
      avatar: avatar,
    });

    return res.status(200).json({
      message: "Team updated successfully",
      team,
    });

  } catch(err) {
    console.error('Error in updateTeam:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getTeamMembers = async (req, res) => {
  try {
    const teamId = req.team_id; // set from auth middleware
    const { channel_id, page = 1, limit = 10, search, role, status } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Base member filter
    const memberWhere = {
      team_id: teamId,
      // status: "active",
    };

    // Build user filter if searching
    const userWhere = {};
    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;

      userWhere[Op.or] = [
        whereFn(fn("LOWER", col("User.name")), {
          [Op.like]: searchTerm,
        }),
        whereFn(fn("LOWER", col("User.email")), {
          [Op.like]: searchTerm,
        }),
      ];
    }

    if(role) {
      memberWhere.role = role.toLowerCase();
    }

    if(status) {
      memberWhere.status = status.toLowerCase();
    }

    // Step 1: Get paginated team members with user info
    const { rows: members, count: total } = await TeamMember.findAndCountAll({
      where: memberWhere,
      include: [
        {
          model: User,
          where: userWhere,
          attributes: [
            "id",
            "name",
            "email",
            "avatar",
            "phone",
            "country_code",
            "created_at"
          ],
        },
      ],
      offset,
      limit: parseInt(limit),
      order: [["created_at", "DESC"]],
    });

    // Step 2: If channel_id is provided, get member map
    let channelMemberMap = {};
    if (channel_id) {
      const channelMembers = await ChannelMember.findAll({
        where: { channel_id },
      });
      channelMembers.forEach((cm) => {
        channelMemberMap[cm.user_id] = {
          role: cm.role,
        };
      });
    }

    // Step 3: Map members
    const result = members.map((m) => {
      const user = m.User;
      const inChannel = channelMemberMap[user.id] !== undefined;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        country_code: user.country_code,
        team_role: m.role,
        status: m.status,
        display_name: m.display_name,
        created_at: user.created_at,
        channel_info: channel_id
          ? {
              is_member: inChannel,
              role: inChannel ? channelMemberMap[user.id].role : null,
            }
          : undefined,
      };
    });

    // Step X: Get status and role counts
    const [adminCount, pendingCount, deactivatedCount, totalCount] = await Promise.all([
      TeamMember.count({ where: { team_id: teamId, role: 'admin' } }),
      TeamMember.count({ where: { team_id: teamId, status: 'pending' } }),
      TeamMember.count({ where: { team_id: teamId, status: 'deactivated' } }),
      TeamMember.count({ where: { team_id: teamId } })
    ]);

    // Step 4: Return paginated result
    return res.status(200).json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      members: result,
      counts: {
        admins: adminCount,
        pending: pendingCount,
        deactivated: deactivatedCount,
        total: totalCount
      },
    });
  } catch (err) {
    console.error("Error in getTeamMembers:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.removeUserFromTeam = async (req, res) => {
  const { userId } = req.params;
  const teamId = req.team_id; 
  
  try {
    const member = await TeamMember.findOne({ where: { team_id: teamId, user_id: userId } });

    if (!member) {
      return res.status(404).json({ message: 'Team membership not found' });
    }

    if (member.role === 'admin') {
      const totalAdmins = await TeamMember.count({
        where: {
          team_id: teamId,
          role: 'admin'
        }
      });

      if (totalAdmins <= 1) {
        return res.status(400).json({
          message: 'Cannot remove the last admin from the team'
        });
      }
    }

    await member.destroy();

    return res.status(200).json({ message: 'User removed from team successfully' });
  } catch (err) {
    console.error('Error in removeUserFromTeam:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Admin

exports.getAllTeams = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      created_by,
      created_from,
      created_to,
      min_size,
      max_size
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Base where condition
    const where = {};

    // Search team name
    if (search) {
      where[Op.or] = [
        whereFn(fn('LOWER', col('Team.name')), {
          [Op.like]: `%${search.toLowerCase()}%`
        })
      ];
    }

    // Filter by creator
    if (created_by) {
      where.created_by = created_by;
    }

    // Filter by date range
    if (created_from || created_to) {
      where.created_at = {};
      if (created_from) where.created_at[Op.gte] = new Date(created_from);
      if (created_to) where.created_at[Op.lte] = new Date(created_to);
    }

    // Fetch teams with creator & settings
    const { rows: teams, count: total } = await Team.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Enrich with team size and admin(s)
    const enriched = await Promise.all(
      teams.map(async (team) => {
        const members = await TeamMember.findAll({
          where: { team_id: team.id, status: { [Op.in]: ['active', 'pending'] } },
          include: {
            model: User,
            attributes: ['id', 'name', 'email']
          }
        });

        const totalMembers = members.length;

        const admins = members
          .filter(m => m.role === 'admin')
          .map(m => ({
            id: m.User.id,
            name: m.User.name,
            email: m.User.email
          }));

        return {
          id: team.id,
          name: team.name,
          created_at: team.created_at,
          created_by: team.creator ? {
            id: team.creator.id,
            name: team.creator.name,
            email: team.creator.email
          } : null,
          total_members: totalMembers,
          admins
        };
      })
    );

    // Apply team size filtering after enrichment
    const filtered = enriched.filter(team => {
      if (min_size && team.total_members < parseInt(min_size)) return false;
      if (max_size && team.total_members > parseInt(max_size)) return false;
      return true;
    });

    return res.status(200).json({
      total: filtered.length,
      page: parseInt(page),
      limit: parseInt(limit),
      teams: filtered
    });

  } catch (err) {
    console.error('Error in getAllTeams:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
