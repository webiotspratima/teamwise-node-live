const { Op, Sequelize } = require("sequelize");
const {
  Message,
  ChannelSetting,
  ChannelMember,
  MessageStatus,
  MessageReaction,
  User,
  Channel,
  PinnedConversation,
  MutedChat,
  MessagePin,
  MessageFavorite,
} = require("../models");

// Helper to check posting permission in a channel
async function canPostMessage(userId, channelId) {
  const channelSetting = await ChannelSetting.findOne({ where: { channel_id: channelId } });
  if (!channelSetting) return false;

  if (channelSetting.allow_posting === "all") return true;

  if (channelSetting.allow_posting === "admin") {
    // Check if user is channel admin (assuming ChannelMember has role)
    const membership = await ChannelMember.findOne({
      where: { channel_id: channelId, user_id: userId, role: "admin" },
    });
    return !!membership;
  }

  return false;
}

// Create/send a message (channel or DM)
exports.createMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { channel_id, recipient_id, content, message_type, file_url, file_type, metadata, parent_id } = req.body;

    // Validate: only one of channel_id or recipient_id must be set
    if ((channel_id && recipient_id) || (!channel_id && !recipient_id)) {
      return res.status(400).json({ message: "Provide either channel_id or recipient_id, not both." });
    }

    if (channel_id) {
      // Check posting permission
      const allowed = await canPostMessage(senderId, channel_id);
      if (!allowed) {
        return res.status(403).json({ message: "You do not have permission to post in this channel." });
      }
    }

    const message = await Message.create({
      sender_id: senderId,
      channel_id: channel_id || null,
      team_id: req.team_id,
      recipient_id: recipient_id || null,
      content,
      message_type: message_type || "text",
      file_url,
      file_type,
      metadata,
      parent_id,
    });

    // For each recipient (or channel member if channel), create "sent" status
    const recipients = !channel_id
      ? [recipient_id]
      : (await ChannelMember.findAll({ where: { channel_id } })).map((u) => u.user_id);

    await MessageStatus.bulkCreate(
      recipients.map((uid) => ({
        message_id: message.id,
        user_id: uid,
        status: "sent",
      }))
    );

    // Load full message with associations
    const fullMessage = await Message.findByPk(message.id, {
      include: [
        { model: User, as: "sender", attributes: ["id", "name", "avatar"] },
        { model: User, as: "recipient", attributes: ["id", "name", "avatar"], required: false },
      ],
    });

    // Emit real-time new message event via Socket.IO (if io instance available)
    const io = req.app.get("io");
    const isPersonalMessage = senderId == recipient_id;
    if (recipient_id) {
      if (isPersonalMessage) {
        io.to(`user_${senderId}`).emit("receive-message", fullMessage);
      } else {
        io.to(`user_${senderId}`).emit("receive-message", fullMessage);
        io.to(`user_${recipient_id}`).emit("receive-message", fullMessage);
      }

      io.to(`user_${senderId}`).emit("message-status-updated", {
        messageId: message.id,
        status: "sent",
      });
    } else if (channel_id) {
      io.to(`channel_${channel_id}`).emit("receive-message", fullMessage);
    }

    return res.status(201).json(message);
  } catch (error) {
    console.error("Error in createMessage:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const groupMessagesByDate = (messages) => {
  const grouped = {};
  messages.reverse();
  messages.forEach((msg) => {
    const date = new Date(msg.created_at);
    const today = new Date();
    const msgDate = date.toDateString();
    const todayDate = today.toDateString();
    const yesterdayDate = new Date(today.setDate(today.getDate() - 1)).toDateString();

    let label;
    if (msgDate === todayDate) {
      label = "Today";
    } else if (msgDate === yesterdayDate) {
      label = "Yesterday";
    } else {
      label = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(msg);
  });

  // Optional: convert object to array for ordered sections
  return Object.entries(grouped).map(([label, messages]) => ({
    label,
    messages,
  }));
};


exports.getMessages = async (req, res) => {
 try {
 const userId = req.user.id;
 const { channel_id, recipient_id, limit = 50, offset = 0 } = req.query;

 if ((channel_id && recipient_id) || (!channel_id && !recipient_id)) {
 return res.status(400).json({ message: "Provide either channel_id or recipient_id." });
 }

 let whereClause = { team_id: req.team_id };

 if (channel_id) {
 const membership = await ChannelMember.findOne({
 where: { user_id: userId, channel_id },
 });
 if (!membership) {
 return res.status(403).json({ message: "You are not a member of this channel." });
 }
 whereClause.channel_id = channel_id;
 } else if (recipient_id) {
 whereClause = {
 [Op.or]: [
 { sender_id: userId, recipient_id },
 { sender_id: recipient_id, recipient_id: userId },
 ],
 };
 }

 const commonIncludes = [
 {
 model: User,
 as: "sender",
 attributes: ["id", "name", "email", "avatar"],
 },
 {
 model: User,
 as: "recipient",
 attributes: ["id", "name", "email", "avatar"],
 },
 {
 model: MessageStatus,
 as: "statuses",
 attributes: ["user_id", "status", "updated_at"],
 },
 {
 model: MessageReaction,
 as: "reaction",
 attributes: ["user_id", "emoji"],
 },
 {
 model: MessageFavorite,
 as: "favorites",
 where: { user_id: userId },
 required: false,
 attributes: ["id"],
 },
 ];

 // For first request (offset = 0), include pinned messages at the top
 let pinnedMessages = [];
 if (offset === 0 || offset === "0") {
 pinnedMessages = await Message.findAll({
 where: whereClause,
 include: [
 ...commonIncludes,
 {
 model: MessagePin,
 as: "pins",
 required: true,
 attributes: ["pinned_by"],
 },
 ],
 order: [["created_at", "DESC"]],
 });
 }

 // Get regular messages with pagination
 // IMPORTANT: Order by DESC to get newest messages first for initial load
 // For subsequent pages, this gets older messages
 const regularMessages = await Message.findAll({
 where: {
 ...whereClause,
 ...(pinnedMessages.length > 0 && { id: { [Op.notIn]: pinnedMessages.map(m => m.id) } }),
 },
 include: commonIncludes,
 order: [["created_at", "DESC"]], // Keep DESC for pagination to work correctly
 limit: +limit,
 offset: +offset,
 });

 // Combine and enhance messages
 let allMessages = [];
 
 if (offset === 0 || offset === "0") {
 // For first page, include pinned messages at top, then regular messages
 allMessages = [
 ...pinnedMessages.map(m => {
  const plain =  m.get({ plain: true })
 const reactions = plain.reaction.reduce((acc, r) => {

          if (!acc[r.emoji]) {

            acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] };

          }

          acc[r.emoji].count++;

          acc[r.emoji].users.push(String(r.user_id));

          return acc;

        }, {});
  return{
...plain,
 reactions: Object.values(reactions),
 isPinned: true,
 isFavorite: m.favorites && m.favorites.length > 0,
 }}),
  ...regularMessages.map((m) => {

        const plain = m.get({ plain: true });

        const reactions = plain.reaction.reduce((acc, r) => {

          if (!acc[r.emoji]) {

            acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] };

          }

          acc[r.emoji].count++;

          acc[r.emoji].users.push(String(r.user_id));

          return acc;

        }, {});

        return {

          ...plain,

          reactions: Object.values(reactions),

          isPinned: false,

          isFavorite: m.favorites && m.favorites.length > 0,

        };

      }),
 ];
 } else {
 // For subsequent pages (older messages), only regular messages
 allMessages = regularMessages.map(m => ({
 ...m.get({ plain: true }),
 isPinned: false,
 isFavorite: m.favorites && m.favorites.length > 0,
 }));
 }

 const response = {
 messages: allMessages.reverse(), 
 hasMore: regularMessages.length === +limit,
 totalCount: allMessages.length,
 offset: +offset,
 nextOffset: regularMessages.length === +limit ? +offset + +limit : null,
 isFirstPage: offset === 0 || offset === "0" 
 };

 return res.json(response);
 } catch (error) {
 console.error("Error in getMessages:", error);
 return res.status(500).json({ message: "Internal server error" });
 }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // 0) Fetch pinned conversations
    const pinnedRecords = await PinnedConversation.findAll({
      where: { user_id: userId },
      attributes: ["type", "target_id"],
      raw: true,
    });

    const pinnedMap = new Map();
    for (const pin of pinnedRecords) {
      pinnedMap.set(`${pin.type}_${pin.target_id}`, true);
    }

    // 1) CHANNELS
    const channelMemberships = await ChannelMember.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Channel,
          where: { team_id: req.team_id },
          attributes: ["id", "name", "avatar", "created_at"],
          require: true,
        },
      ],
    });

    const channelIds = channelMemberships.map((c) => c.Channel.id);

    // Get last messages for channels
    const lastMessagesByChannel = await Message.findAll({
      where: {
        channel_id: channelIds,
        team_id: req.team_id,
      },
      attributes: ["id", "content", "created_at", "sender_id", "channel_id"],
      order: [["created_at", "DESC"]],
    });

    const lastMessageMap = new Map();
    for (const msg of lastMessagesByChannel) {
      if (!lastMessageMap.has(msg.channel_id)) {
        lastMessageMap.set(msg.channel_id, msg);
      }
    }

    // Get unread counts for channels
    const channelUnreadCounts = await Promise.all(
      channelIds.map(async (channelId) => {
        const count = await Message.count({
          where: {
            channel_id: channelId,
            team_id: req.team_id,
            [Op.not]: { sender_id: userId }, // Only count messages not sent by current user
          },
          include: [
            {
              model: MessageStatus,
              as: "statuses",
              where: {
                user_id: userId, // Check status for current user (recipient)
                status: "delivered",
              },
              required: false,
            },
          ],
          // having: Sequelize.literal('COUNT(statuses.id) = 0 OR MAX(statuses.status) != "seen"')
        });
        return { channelId, unreadCount: count };
      })
    );

    const channelUnreadMap = new Map();
    channelUnreadCounts.forEach((item) => {
      channelUnreadMap.set(item.channelId, item.unreadCount);
    });

    const channelList = channelMemberships.map((cm) => {
      const channel = cm.Channel.toJSON();
      const lastMsg = lastMessageMap.get(channel.id);
      const key = `channel_${channel.id}`;
      return {
        type: "channel",
        id: channel.id,
        name: channel.name,
        avatar: channel.avatar,
        description: channel.description,
        created_by: channel.created_by,
        latest_message_at: lastMsg ? lastMsg.created_at : channel.created_at,
        last_message: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.content,
              sender_id: lastMsg.sender_id,
              created_at: lastMsg.created_at,
            }
          : null,
        pinned: pinnedMap.has(key),
        unread_count: channelUnreadMap.get(channel.id) || 0,
      };
    });

    // 2) DMs
    const dmMessages = await Message.findAll({
      where: {
        [Op.or]: [{ sender_id: userId }, { recipient_id: userId }],
        team_id: req.team_id,
      },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name", "avatar", "email", "is_online", "last_seen"],
        },
        {
          model: User,
          as: "recipient",
          attributes: ["id", "name", "avatar", "email", "is_online", "last_seen"],
        },
      ],
      attributes: [
        "id",
        "content",
        "created_at",
        "sender_id",
        "recipient_id",
        [Sequelize.literal(`CASE WHEN sender_id = ${userId} THEN recipient_id ELSE sender_id END`), "dm_user_id"],
      ],
      order: [["created_at", "DESC"]],
    });

    const dmMap = new Map();
    for (const msg of dmMessages) {
      const otherId = msg.get("dm_user_id");
      if (!dmMap.has(otherId)) {
        dmMap.set(otherId, msg);
      }
    }

    const dmUserIds = Array.from(dmMap.keys());

    // Get unread counts for DMs (only messages sent to current user)
    const dmUnreadCounts = await Promise.all(
      dmUserIds.map(async (otherId) => {
        const count = await Message.count({
          where: {
            sender_id: otherId, // Messages sent by the other user
            recipient_id: userId, // To current user
            team_id: req.team_id,
          },
          include: [
            {
              model: MessageStatus,
              as: "statuses",
              where: {
                user_id: userId, // Status for current user (recipient)
                status: "delivered",
              },
              required: true,
            },
          ],
          // having: Sequelize.literal('COUNT(statuses.id) = 0 OR MAX(statuses.status) == "delivered"')
        });
        return { otherId, unreadCount: count };
      })
    );

    const dmUnreadMap = new Map();
    dmUnreadCounts.forEach((item) => {
      dmUnreadMap.set(item.otherId, item.unreadCount);
    });

    const dmUsers = await User.findAll({
      where: { id: dmUserIds },
      attributes: ["id", "name", "email", "avatar"],
    });

    const dmList = dmUsers.map((user) => {
      const msg = dmMap.get(user.id);
      const key = `dm_${user.id}`;
      return {
        type: "dm",
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        latest_message_at: msg.created_at,
        last_message: {
          id: msg.id,
          content: msg.content,
          sender_id: msg.sender_id,
          created_at: msg.created_at,
        },
        pinned: pinnedMap.has(key),
        unread_count: dmUnreadMap.get(user.id) || 0,
      };
    });

    // 3) Separate and sort
    const pinnedList = [];
    const unpinnedChannels = [];
    const unpinnedDMs = [];

    for (const item of [...channelList, ...dmList]) {
      if (item.pinned) {
        pinnedList.push(item);
      } else if (item.type === "channel") {
        unpinnedChannels.push(item);
      } else if (item.type === "dm") {
        unpinnedDMs.push(item);
      }
    }

    const sortByLatest = (a, b) => {
      const timeA = new Date(a.latest_message_at).getTime() || 0;
      const timeB = new Date(b.latest_message_at).getTime() || 0;
      return timeB - timeA;
    };

    pinnedList.sort(sortByLatest);
    unpinnedChannels.sort(sortByLatest);
    unpinnedDMs.sort(sortByLatest);

    const combined = [...pinnedList, ...unpinnedChannels, ...unpinnedDMs];
    const paginated = combined.slice(offset, offset + limit);

    return res.json(paginated);
  } catch (error) {
    console.error("Error in getConversations:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.pinOrUnpinConversation = async (req, res) => {
  try {
    const { type, target_id, pin } = req.body;
    const userId = req.user.id;

    // 1. Validate `type`
    if (!["channel", "dm"].includes(type)) {
      return res.status(400).json({ message: "Invalid conversation type" });
    }

    // 2. Validate `pin` is boolean
    if (typeof pin !== "boolean") {
      return res.status(400).json({ message: "`pin` must be true or false" });
    }

    // 3. Validate `target_id` exists
    if (type === "channel") {
      const channel = await Channel.findByPk(target_id);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
    } else if (type === "dm") {
      const user = await User.findByPk(target_id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
    }

    if (!pin) {
      // 4. Unpin logic
      await PinnedConversation.destroy({
        where: { user_id: userId, type, target_id },
      });
      return res.json({ message: "Conversation unpinned successfully" });
    } else {
      // 5. Pin logic (create only if not exists)
      await PinnedConversation.findOrCreate({
        where: { user_id: userId, type, target_id },
      });
      return res.json({ message: "Conversation pinned successfully" });
    }
  } catch (error) {
    console.error("Error in pinOrUnpinConversation:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message_id, content } = req.body;

    if (!message_id || !content) {
      return res.status(400).json({ message: "Message ID and new content are required." });
    }

    // Fetch the message
    const message = await Message.findByPk(message_id);

    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    // Only sender can edit
    if (message.sender_id !== userId) {
      return res.status(403).json({ message: "You are not authorized to edit this message." });
    }

    // Update only content
    message.content = content;
    await message.save();

    // Fetch updated message with associations for real-time update
    const updatedMessage = await Message.findByPk(message.id, {
      include: [
        { model: User, as: "sender", attributes: ["id", "name", "avatar"] },
        { model: User, as: "recipient", attributes: ["id", "name", "avatar"], required: false },
      ],
    });

    // Emit socket event for message update
    const io = req.app.get("io");
    if (message.channel_id) {
      io.to(`channel_${message.channel_id}`).emit("message-updated", updatedMessage);
    } else if (message.recipient_id) {
      io.to(`user_${message.sender_id}`).emit("message-updated", updatedMessage);
      io.to(`user_${message.recipient_id}`).emit("message-updated", updatedMessage);
    }

    return res.status(200).json({ message: "Message updated successfully.", data: updatedMessage });
  } catch (error) {
    console.error("Error in editMessage:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const message = await Message.findOne({ where: { id: id } });

    if (!message || message.sender_id !== userId) {
      return res.status(403).json({ message: "Unauthorized or message not found." });
    }

    await message.destroy(); // soft delete
    const io = req.app.get("io");
    if (message.channel_id) {
      io.to(`channel_${message.channel_id}`).emit("message-deleted", message);
    } else if (message.recipient_id) {
      io.to(`user_${message.sender_id}`).emit("message-deleted", message);
      io.to(`user_${message.recipient_id}`).emit("message-deleted", message);
    }
    return res.status(200).json({ message: "Message deleted." });
  } catch (err) {
    console.error("Error in deleteMessage:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.addReaction = async (req, res) => {
  try {
    const { message_id, emoji } = req.body;
    const userId = req.user.id;

    // Validate emoji is a string
    if (typeof emoji !== "string") {
      return res.status(400).json({ message: "Emoji must be a string" });
    }

    const message = await Message.findByPk(message_id);

    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    // Ensure only one reaction per user per message
    const existing = await MessageReaction.findOne({
      where: { message_id, user_id: userId },
    });
    if (existing) {
      if (existing.emoji !== emoji) {
        await existing.update({ emoji });
      }
      // If same, do nothing (toggle handled in frontend)
    } else {
      await MessageReaction.create({ message_id, user_id: userId, emoji });
    }
    const io = req.app.get("io");

    // Get updated reactions
    const rawReactions = await MessageReaction.findAll({
      where: { message_id },
    });
    const grouped = rawReactions.reduce((acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
      acc[r.emoji].count++;
      acc[r.emoji].users.push(r.user_id);
      return acc;
    }, {});
    const reactions = Object.values(grouped);

    if (message.channel_id) {
      io.to(`channel_${message.channel_id}`).emit("message-reaction-updated", {
       message_id,
       reactions,
     });
    } else if (message.sender_id && message.recipient_id) {
        io.to(`user_${message.sender_id}`).emit("message-reaction-updated", {
          message_id,
          reactions,
        });

         io.to(`user_${message.recipient_id}`).emit(
           "message-reaction-updated",
           {
             message_id,
             reactions,
           }
         );
    } else {
      console.warn(`Cannot determine room for message id ${message.id}`);
      return res
        .status(400)
        .json({ message: "Invalid message for reaction room" });
    }

    return res.status(200).json({ message: "Reaction added." });
  } catch (err) {
    console.error("Error in addReaction:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.removeReaction = async (req, res) => {
  try {
    const { message_id, emoji } = req.body;
    const userId = req.user.id;

    await MessageReaction.destroy({
      where: { message_id, user_id: userId, emoji },
    });
    const io = req.app.get("io");

    // Get updated reactions (same as addReaction)
    const rawReactions = await MessageReaction.findAll({
      where: { message_id },
    });
    const grouped = rawReactions.reduce((acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
      acc[r.emoji].count++;
      acc[r.emoji].users.push(r.user_id);
      return acc;
    }, {});
    const reactions = Object.values(grouped);

    const message = await Message.findByPk(message_id);
    if (message.channel_id) {
      io.to(`channel_${message.channel_id}`).emit('message-reaction-updated', {
        message_id,
        reactions,
      });
    } else if (message.sender_id && message.recipient_id) {
      io.to(`user_${message.sender_id}`).emit('message-reaction-updated', {
        message_id,
        reactions,
      });
      io.to(`user_${message.recipient_id}`).emit('message-reaction-updated',{
        message_id,
        reactions,
      });
    } else {
      console.warn(`Cannot determine room for message id ${message.id}`);
      return res
        .status(400)
        .json({ message: "Invalid message for reaction room" });
    }

    return res.status(200).json({ message: "Reaction removed." });
  } catch (err) {
    console.error("Error in removeReaction:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.muteChat = async (req, res) => {
  try {
    const { target_id, target_type, duration } = req.body;
    const userId = req.user.id;

    let mutedUntil = null;
    const now = new Date();

    if (duration === "1h") {
      mutedUntil = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    } else if (duration === "8h") {
      mutedUntil = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    } else if (duration === "1w") {
      mutedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (duration === "forever") {
      mutedUntil = new Date("2100-01-01T00:00:00Z");
    } else {
      return res.status(400).json({ success: false, message: "Invalid mute duration." });
    }

    await MutedChat.upsert({
      user_id: userId,
      target_id,
      target_type,
      muted_until: mutedUntil,
    });

    return res.status(200).json({ message: "Chat muted successfully." });
  } catch (error) {
    console.error("Error in muteChat:", error);
    res.status(500).json({ success: false, message: "Failed to mute chat.", error: error.message });
  }
};

exports.unmuteChat = async (req, res) => {
  const { target_id, target_type } = req.body;
  const userId = req.user.id;

  await MutedChat.destroy({
    where: { user_id: userId, target_id, target_type },
  });

  return res.status(200).json({ message: "Chat unmuted successfully." });
};

exports.pinMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message_id } = req.body;

    if (!message_id) {
      return res.status(400).json({ message: "Message ID is required." });
    }

    const message = await Message.findByPk(message_id);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    // Check if already pinned
    const existingPin = await MessagePin.findOne({ where: { message_id, pinned_by: userId } });
    if (existingPin) {
      return res.status(400).json({ message: "Message already pinned." });
    }

    await MessagePin.create({
      message_id,
      pinned_by: userId,
      channel_id: message.channel_id || null,
    });

    const io = req.app.get("io");
    const payload = {
      message_id,
      isPinned: true,
    };
    if (message.channel_id) {
      io.to(`channel_${message.channel_id}`).emit("message-pin", payload);
    } else if (message.recipient_id) {
      io.to(`user_${message.sender_id}`).emit("message-pin", payload);
      io.to(`user_${message.recipient_id}`).emit("message-pin", payload);
    } 

    return res.status(200).json({ message: "Message pinned successfully." });
  } catch (err) {
    console.error("Error in pinMessage:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.unpinMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message_id } = req.body;

    const pin = await MessagePin.findOne({ where: { message_id, pinned_by: userId } });
    if (!pin) {
      return res.status(404).json({ message: "Pinned message not found for this user." });
    }

    await pin.destroy();

    const io = req.app.get("io");
      const payload = {
      message_id,
      isPinned: false,
    };
    if (pin.channel_id) {
      io.to(`channel_${pin.channel_id}`).emit("message-pin", payload);
    } else if (pin.recipient_id) {
      io.to(`user_${pin.sender_id}`).emit("message-pin", payload);
      io.to(`user_${pin.recipient_id}`).emit("message-pin", payload);
    }

    return res.status(200).json({ message: "Message unpinned successfully." });
  } catch (err) {
    console.error("Error in unpinMessage:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.favoriteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message_id } = req.body;

    if (!message_id) {
      return res.status(400).json({ message: "Message ID is required." });
    }

    const message = await Message.findByPk(message_id);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const existingFav = await MessageFavorite.findOne({ where: { message_id, user_id: userId } });
    if (existingFav) {
      return res.status(400).json({ message: "Message already favorited." });
    }

    await MessageFavorite.create({ message_id, user_id: userId });
    const io = req.app.get("io");
       const payload = {
      message_id,
      isFavorite: true,
    };
    io.to(`user_${userId}`).emit("message-favorite", payload);

    return res.status(200).json({ message: "Message favorited successfully." });
  } catch (err) {
    console.error("Error in favoriteMessage:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.unfavoriteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message_id } = req.body;

    const fav = await MessageFavorite.findOne({ where: { message_id, user_id: userId } });
    if (!fav) {
      return res.status(404).json({ message: "Favorite not found." });
    }

    await fav.destroy();
    const io = req.app.get("io");
      const payload = {
      message_id,
      isFavorite: false,
    };
    io.to(`user_${userId}`).emit("message-favorite", payload);

    return res.status(200).json({ message: "Message unfavorited successfully." });
  } catch (err) {
    console.error("Error in unfavoriteMessage:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
