const { Op } = require("sequelize");
const { User, Message, MessageStatus, ChannelMember } = require("../models");

// module.exports = function initSockets(io) {
//   // Store user socket mappings
//   const userSockets = new Map(); // userId -> socketId
//   const socketUsers = new Map(); // socketId -> userId
//   const userStatus = new Map();

//   // Call management
//   const activeCalls = new Map(); // callId -> call data
//   const userCalls = new Map(); // userId -> callId

//   io.on("connection", (socket) => {
//     console.log(`Socket connected: ${socket.id}`);

//     socket.on("join-room", async (userId) => {
//       const existingSocketId = userSockets.get(userId);
//       if (existingSocketId && existingSocketId !== socket.id) {
//         const existingSocket = io.sockets.sockets.get(existingSocketId);
//         if (existingSocket) {
//           existingSocket.disconnect(true);
//         }
//         socketUsers.delete(existingSocketId);
//       }

//       userSockets.set(userId, socket.id);
//       socketUsers.set(socket.id, userId);
//       socket.userId = userId;

//       try {
//         const userChannels = await ChannelMember.findAll({
//           where: { user_id: userId },
//           attributes: ["channel_id"],
//         });

//         // Join all channels the user is a member of
//         userChannels.forEach((channelMember) => {
//           socket.join(`channel_${channelMember.channel_id}`);
//           console.log(`User ${userId} auto-joined channel_${channelMember.channel_id}`);
//         });
//       } catch (error) {
//         console.error(`Error joining user ${userId} to channels:`, error);
//       }

//       // Join user's personal room for direct messages
//       socket.join(`user_${userId}`);

//       // Update user status to online
//       userStatus.set(userId, { status: "online", lastSeen: null });

//       // Send current online users status to the newly joined user
//       const onlineUsers = [];
//       for (const [uid, statusInfo] of userStatus.entries()) {
//         if (statusInfo.status === "online" && uid !== userId) {
//           onlineUsers.push({
//             userId: uid,
//             status: statusInfo.status,
//           });
//         }
//       }

//       if (onlineUsers.length > 0) {
//         socket.emit("bulk-user-status-update", onlineUsers);
//       }

//       socket.broadcast.emit("user-status-update", {
//         userId,
//         status: "online",
//       });

//       // Handle undelivered messages (existing code)
//       const undeliveredStatuses = await MessageStatus.findAll({
//         where: {
//           status: "sent",
//         },
//         include: [{ model: Message, as: "message" }],
//       });

//       const messageIds = undeliveredStatuses.map((ms) => ms.message_id);

//       if (messageIds.length > 0) {
//         await MessageStatus.update(
//           { status: "delivered" },
//           {
//             where: {
//               message_id: messageIds,
//               status: "sent",
//             },
//           }
//         );

//         for (const status of undeliveredStatuses) {
//           const senderId = status.message.sender_id;
//           io.to(`user_${senderId}`).emit("message-status-updated", {
//             messageId: status.message_id,
//             userId,
//             status: "delivered",
//           });
//         }
//       }

//       console.log(`User ${userId} joined personal room user_${userId} with socket ${socket.id}`);
//     });

//     // Call-related socket handlers
//     socket.on("initiate-call", async (data) => {
//       const { callId, chatId, chatType, callType, chatName, initiator } = data;

//       // Store call data, including initiator in participants
//       activeCalls.set(callId, {
//         callId,
//         chatId,
//         chatType,
//         callType,
//         chatName,
//         initiator,
//         participants: new Map([
//           [
//             initiator.userId,
//             {
//               userId: initiator.userId,
//               socketId: socket.id,
//               name: initiator.name,
//               avatar: initiator.avatar,
//               joinedAt: new Date(),
//             },
//           ],
//         ]),
//         startTime: new Date(),
//         status: "calling",
//       });

//       userCalls.set(initiator.userId, callId);

//       // Notify target users (unchanged)
//       if (chatType === "channel") {
//         // Notify all channel members except initiator
//         try {
//           const channelMembers = await ChannelMember.findAll({
//             where: { channel_id: chatId },
//             include: [{ model: User, attributes: ["id", "name", "avatar"] }],
//           });

//           channelMembers.forEach((member) => {
//             if (member.user_id !== initiator.userId) {
//               const memberSocketId = userSockets.get(member.user_id);
//               if (memberSocketId) {
//                 io.to(`user_${member.user_id}`).emit("incoming-call", {
//                   callId,
//                   chatId,
//                   chatType,
//                   callType,
//                   chatName,
//                   initiator,
//                 });
//               }
//             }
//           });
//         } catch (error) {
//           console.error("Error notifying channel members:", error);
//         }
//       } else {
//         // Direct message call
//         io.to(`user_${chatId}`).emit("incoming-call", {
//           callId,
//           chatId,
//           chatType,
//           callType,
//           chatName,
//           initiator,
//         });
//       }

//       console.log(`Call ${callId} initiated by ${initiator.userId} in ${chatType} ${chatId}`);
//     });

//     // Replace your accept-call handler with this fixed version
//     socket.on("accept-call", async (data) => {
//       const { callId, user } = data;
//       const call = activeCalls.get(callId);

//       if (!call) {
//         console.error(`Call ${callId} not found`);
//         return;
//       }

//       // Add user to call participants
//       call.participants.set(user.userId, {
//         userId: user.userId,
//         socketId: socket.id,
//         name: user.name,
//         avatar: user.avatar,
//         joinedAt: new Date(),
//       });

//       userCalls.set(user.userId, callId);
//       call.status = "connected";

//       // Create complete participants list including initiator
//       const allParticipants = new Map();
      
//       // Always include initiator first
//       allParticipants.set(call.initiator.userId, {
//         userId: call.initiator.userId,
//         socketId: userSockets.get(call.initiator.userId) || '',
//         name: call.initiator.name,
//         avatar: call.initiator.avatar,
//         joinedAt: call.startTime,
//       });
      
//       // Add all other participants
//       call.participants.forEach((participant, participantId) => {
//         allParticipants.set(participantId, participant);
//       });

//       // Notify existing participants (including initiator) about the new joiner
//       call.participants.forEach((participant, participantId) => {
//         if (participantId !== user.userId) {
//           io.to(`user_${participantId}`).emit("call-accepted", {
//             callId,
//             userId: user.userId,
//             user,
//           });
//         }
//       });

//       // Also notify initiator if they're not in participants yet
//       if (!call.participants.has(call.initiator.userId)) {
//         io.to(`user_${call.initiator.userId}`).emit("call-accepted", {
//           callId,
//           userId: user.userId,
//           user,
//         });
//       }

//       // Send complete participant sync to the new joiner
//       // This ensures they see ALL current participants including initiator
//       io.to(socket.id).emit("call-participants-sync", {
//         callId,
//         participants: Array.from(allParticipants.entries()).map(([userId, participant]) => ({
//           userId,
//           socketId: participant.socketId,
//           name: participant.name,
//           avatar: participant.avatar,
//           joinedAt: participant.joinedAt,
//         }))
//       });

//       console.log(`User ${user.userId} accepted call ${callId}`);
//       console.log(`Synced ${allParticipants.size} participants to new joiner`);
//     });

//     socket.on("decline-call", async (data) => {
//       const { callId } = data;
//       const call = activeCalls.get(callId);

//       if (call) {
//         // Notify initiator about the decline
//         io.to(`user_${call.initiator.userId}`).emit("call-declined", {
//           callId,
//         });

//         // Notify any other participants who might have joined
//         call.participants.forEach((participant) => {
//           if (participant.userId !== call.initiator.userId) {
//             io.to(`user_${participant.userId}`).emit("call-ended", { callId });
//           }
//           userCalls.delete(participant.userId);
//         });

//         // For channel calls, notify other members that call was declined
//         if (call.chatType === "channel") {
//           try {
//             const channelMembers = await ChannelMember.findAll({
//               where: { channel_id: call.chatId },
//               include: [{ model: User, attributes: ["id", "name", "avatar"] }],
//             });

//             channelMembers.forEach((member) => {
//               // Notify members who aren't the initiator or the decliner
//               if (
//                 member.user_id !== call.initiator.userId &&
//                 member.user_id !== socket.userId
//               ) {
//                 io.to(`user_${member.user_id}`).emit("call-ended", { callId });
//                 userCalls.delete(member.user_id);
//               }
//             });
//           } catch (error) {
//             console.error(
//               "Error notifying channel members of call decline:",
//               error
//             );
//           }
//         }
//         // Clean up call
//         activeCalls.delete(callId);
//         userCalls.delete(call.initiator.userId);
//       }

//       console.log(`Call ${callId} declined by user ${socket.userId}`);
//     });
    
//     // Call-related socket handlers
//     socket.on("end-call", async (data) => {
//       const { callId } = data;
//       const call = activeCalls.get(callId);

//       if (call) {
//         // Notify all participants who have joined the call
//         call.participants.forEach((participant) => {
//           io.to(`user_${participant.userId}`).emit("call-ended", { callId });
//           userCalls.delete(participant.userId);
//         });
//         io.to(`user_${call.initiator.userId}`).emit("call-ended", { callId });
//         userCalls.delete(call.initiator.userId);

//         // IMPORTANT: Also notify all users who received the incoming call but haven't joined yet
//         if (call.chatType === "channel") {
//           // Notify all channel members except those who already joined
//           try {
//             const channelMembers = await ChannelMember.findAll({
//               where: { channel_id: call.chatId },
//               include: [{ model: User, attributes: ["id", "name", "avatar"] }],
//             });

//             channelMembers.forEach((member) => {
//               // Only notify if they're not the initiator and not already in participants
//               if (
//                 member.user_id !== call.initiator.userId &&
//                 !call.participants.has(member.user_id)
//               ) {
//                 io.to(`user_${member.user_id}`).emit("call-ended", { callId });
//                 userCalls.delete(member.user_id); // Clean up any potential call mapping
//               }
//             });
//           } catch (error) {
//             console.error(
//               "Error notifying channel members of call end:",
//               error
//             );
//           }
//         } else {
//           // Direct message call - notify the other user if they haven't joined
//           if (
//             call.chatId !== call.initiator.userId &&
//             !call.participants.has(call.chatId)
//           ) {
//             io.to(`user_${call.chatId}`).emit("call-ended", { callId });
//             userCalls.delete(call.chatId);
//           }
//         }
//         // Clean up call
//         activeCalls.delete(callId);
//       }
//     });

//     // WebRTC signaling
//     socket.on("webrtc-offer", (data) => {
//       const { callId, targetUserId, offer } = data;
//       const fromUserId = socket.userId;

//       io.to(`user_${targetUserId}`).emit("webrtc-offer", {
//         callId,
//         fromUserId,
//         offer,
//       });
//     });

//     socket.on("webrtc-answer", (data) => {
//       const { callId, targetUserId, answer } = data;
//       const fromUserId = socket.userId;

//       io.to(`user_${targetUserId}`).emit("webrtc-answer", {
//         callId,
//         fromUserId,
//         answer,
//       });
//     });

//     socket.on("ice-candidate", (data) => {
//       const { callId, targetUserId, candidate } = data;
//       const fromUserId = socket.userId;

//       io.to(`user_${targetUserId}`).emit("ice-candidate", {
//         callId,
//         fromUserId,
//         candidate,
//       });
//     });

//     // Call control events
//     socket.on("toggle-video", (data) => {
//       const { callId, isVideoEnabled } = data;
//       const userId = socket.userId;
//       const call = activeCalls.get(callId);

//       if (call) {
//         // Notify other participants
//         call.participants.forEach((participant) => {
//           if (participant.userId !== userId) {
//             io.to(`user_${participant.userId}`).emit("participant-toggle-video", {
//               callId,
//               userId,
//               isVideoEnabled,
//             });
//           }
//         });

//         // Also notify initiator if current user is not initiator
//         if (call.initiator.userId !== userId) {
//           io.to(`user_${call.initiator.userId}`).emit("participant-toggle-video", {
//             callId,
//             userId,
//             isVideoEnabled,
//           });
//         }
//       }
//     });

//     socket.on("toggle-audio", (data) => {
//       const { callId, isAudioEnabled } = data;
//       const userId = socket.userId;
//       const call = activeCalls.get(callId);

//       if (call) {
//         // Notify other participants
//         call.participants.forEach((participant) => {
//           if (participant.userId !== userId) {
//             io.to(`user_${participant.userId}`).emit("participant-toggle-audio", {
//               callId,
//               userId,
//               isAudioEnabled,
//             });
//           }
//         });

//         // Also notify initiator if current user is not initiator
//         if (call.initiator.userId !== userId) {
//           io.to(`user_${call.initiator.userId}`).emit("participant-toggle-audio", {
//             callId,
//             userId,
//             isAudioEnabled,
//           });
//         }
//       }
//     });

//     // Existing handlers (status, messages, etc.)
//     socket.on("set-away", () => {
//       const userId = socket.userId;
//       if (userId) {
//         userStatus.set(userId, { status: "away", lastSeen: new Date().toISOString() });
//         socket.broadcast.emit("user-status-update", {
//           userId,
//           status: "away",
//         });
//         console.log(`User ${userId} is away`);
//       }
//     });

//     socket.on("set-online", () => {
//       const userId = socket.userId;
//       if (userId) {
//         userStatus.set(userId, { status: "online", lastSeen: null });
//         socket.broadcast.emit("user-status-update", {
//           userId,
//           status: "online",
//         });
//         console.log(`User ${userId} is back online`);
//       }
//     });

//     socket.on("member-added-to-channel", ({ channelId, userIds, channel }) => {
//       // Notify all added members
//       userIds.forEach((userId) => {
//         io.to(`user_${userId}`).emit("channel-added", channel);

//         // Ensure they join the channel room
//         const memberSocketId = userSockets.get(userId);
//         if (memberSocketId) {
//           const memberSocket = io.sockets.sockets.get(memberSocketId);
//           if (memberSocket) {
//             memberSocket.join(`channel_${channelId}`);
//             console.log(`User ${userId} auto-joined channel_${channelId} after being added`);
//           }
//         }
//       });

//       // Notify existing channel members about new members
//       io.to(`channel_${channelId}`).emit("members-added", {
//         channelId,
//         newMemberIds: userIds,
//       });
//     });

//     socket.on("join-channel", (channelId) => {
//       socket.join(`channel_${channelId}`);
//       console.log(`Socket ${socket.id} joined channel ${channelId}`);
//     });

//     socket.on("typing", (data) => {
//       if (data.channelId) {
//         // Channel typing - broadcast to channel members only (exclude sender)
//         socket.to(`channel_${data.channelId}`).emit("typing", {
//           channelId: data.channelId,
//           userId: data.userId,
//           userName: data.userName,
//           isTyping: data.isTyping,
//         });
//         console.log(`Typing indicator sent to channel_${data.channelId}`);
//       } else if (data.recipientId && data.senderId) {
//         // Direct message typing - send to recipient's personal room
//         io.to(`user_${data.recipientId}`).emit("typing", {
//           senderId: data.senderId,
//           recipientId: data.recipientId,
//           userId: data.userId,
//           userName: data.userName,
//           isTyping: data.isTyping,
//         });
//         console.log(`Direct typing indicator sent from user_${data.senderId} to user_${data.recipientId}`);
//       }
//     });

//     socket.on("message-delivered", async ({ messageId, senderId }) => {
//       const userId = socket.userId;
//       if (!userId || !messageId) return;

//       const [affectedCount] = await MessageStatus.update(
//         { status: "delivered" },
//         {
//           where: {
//             message_id: messageId,
//             status: "sent",
//           },
//         }
//       );

//       if (affectedCount > 0) {
//         io.to(`user_${senderId}`).emit("message-status-updated", {
//           messageId,
//           status: "delivered",
//         });
//       }
//     });

//     socket.on("message-seen", async ({ messageIds, userId }) => {
//       if (!Array.isArray(messageIds) || !socket.userId) return;

//       await MessageStatus.update(
//         { status: "seen" },
//         {
//           where: {
//             message_id: messageIds,
//             user_id: socket.userId,
//             status: { [Op.ne]: "seen" },
//           },
//         }
//       );

//       messageIds.forEach((messageId) => {
//         io.to(`user_${userId}`).emit("message-status-updated", {
//           messageId,
//           userId: socket.userId,
//           status: "seen",
//         });
//       });
//     });

//     socket.on("mark-messages-read", async ({ chatId, type }) => {
//       const userId = socket.userId;
//       if (!userId) return;

//       try {
//         if (type === "channel") {
//           await MessageStatus.update(
//             { status: "seen" },
//             {
//               where: {
//                 user_id: userId,
//                 status: { [Op.ne]: "seen" },
//               },
//               include: [
//                 {
//                   model: Message,
//                   where: { channel_id: chatId },
//                 },
//               ],
//             }
//           );
//         } else {
//           await MessageStatus.update(
//             { status: "seen" },
//             {
//               where: {
//                 user_id: userId,
//                 status: { [Op.ne]: "seen" },
//               },
//               include: [
//                 {
//                   model: Message,
//                   where: {
//                     [Op.or]: [
//                       { sender_id: chatId, recipient_id: userId },
//                       { sender_id: userId, recipient_id: chatId },
//                     ],
//                   },
//                 },
//               ],
//             }
//           );
//         }

//         if (type === "dm") {
//           io.to(`user_${chatId}`).emit("messages-read", {
//             readerId: userId,
//           });
//         } else {
//           const channelMembers = await ChannelMember.findAll({
//             where: { channel_id: chatId },
//             attributes: ["user_id"],
//           });

//           channelMembers.forEach((member) => {
//             if (member.user_id !== userId) {
//               io.to(`user_${member.user_id}`).emit("messages-read", {
//                 channelId: chatId,
//                 readerId: userId,
//               });
//             }
//           });
//         }
//       } catch (error) {
//         console.error("Error marking messages as read:", error);
//       }
//     });

//     socket.on("disconnect", () => {
//       const userId = socketUsers.get(socket.id);
//       if (userId) {
//         const callId = userCalls.get(userId);
//         if (callId) {
//           const call = activeCalls.get(callId);
//           if (call) {
//             call.participants.delete(userId);

//             // Notify others
//             call.participants.forEach((participant) => {
//               io.to(`user_${participant.userId}`).emit("participant-left", { callId, userId });
//             });
//             if (call.initiator.userId !== userId) {
//               io.to(`user_${call.initiator.userId}`).emit("participant-left", { callId, userId });
//             }

//             // If initiator left or no participants, end call
//             if (call.initiator.userId === userId || call.participants.size === 0) {
//               call.participants.forEach((participant) => {
//                 io.to(`user_${participant.userId}`).emit("call-ended", { callId });
//                 userCalls.delete(participant.userId);
//               });
//               activeCalls.delete(callId);
//             }
//           }
//           userCalls.delete(userId);
//         }

//         userSockets.delete(userId);
//         socketUsers.delete(socket.id);
//         userStatus.set(userId, { status: "offline", lastSeen: new Date().toISOString() });

//         socket.broadcast.emit("user-status-update", {
//           userId,
//           status: "offline",
//         });

//         console.log(`User ${userId} disconnected`);
//       }
//     });
//   });
// };



// module.exports = function initSockets(io) {
//   // Store user socket mappings
//   const userSockets = new Map(); // userId -> socketId
//   const socketUsers = new Map(); // socketId -> userId
//   const userStatus = new Map();

//   // Call management
//   const activeCalls = new Map(); // callId -> call data
//   const userCalls = new Map(); // userId -> callId

//   io.on("connection", (socket) => {
//     console.log(`Socket connected: ${socket.id}`);

//     socket.on("join-room", async (userId) => {
//       const existingSocketId = userSockets.get(userId);
//       if (existingSocketId && existingSocketId !== socket.id) {
//         const existingSocket = io.sockets.sockets.get(existingSocketId);
//         if (existingSocket) {
//           existingSocket.disconnect(true);
//         }
//         socketUsers.delete(existingSocketId);
//       }

//       userSockets.set(userId, socket.id);
//       socketUsers.set(socket.id, userId);
//       socket.userId = userId;

//       try {
//         const userChannels = await ChannelMember.findAll({
//           where: { user_id: userId },
//           attributes: ["channel_id"],
//         });

//         // Join all channels the user is a member of
//         userChannels.forEach((channelMember) => {
//           socket.join(`channel_${channelMember.channel_id}`);
//           console.log(
//             `User ${userId} auto-joined channel_${channelMember.channel_id}`
//           );
//         });
//       } catch (error) {
//         console.error(`Error joining user ${userId} to channels:`, error);
//       }

//       // Join user's personal room for direct messages
//       socket.join(`user_${userId}`);

//       // Update user status to online
//       userStatus.set(userId, { status: "online", lastSeen: null });

//       // Send current online users status to the newly joined user
//       const onlineUsers = [];
//       for (const [uid, statusInfo] of userStatus.entries()) {
//         if (statusInfo.status === "online" && uid !== userId) {
//           onlineUsers.push({
//             userId: uid,
//             status: statusInfo.status,
//           });
//         }
//       }

//       if (onlineUsers.length > 0) {
//         socket.emit("bulk-user-status-update", onlineUsers);
//       }

//       socket.broadcast.emit("user-status-update", {
//         userId,
//         status: "online",
//       });

//       // Handle undelivered messages (existing code)
//       const undeliveredStatuses = await MessageStatus.findAll({
//         where: {
//           status: "sent",
//         },
//         include: [{ model: Message, as: "message" }],
//       });

//       const messageIds = undeliveredStatuses.map((ms) => ms.message_id);

//       if (messageIds.length > 0) {
//         await MessageStatus.update(
//           { status: "delivered" },
//           {
//             where: {
//               message_id: messageIds,
//               status: "sent",
//             },
//           }
//         );

//         for (const status of undeliveredStatuses) {
//           const senderId = status.message.sender_id;
//           io.to(`user_${senderId}`).emit("message-status-updated", {
//             messageId: status.message_id,
//             userId,
//             status: "delivered",
//           });
//         }
//       }

//       console.log(
//         `User ${userId} joined personal room user_${userId} with socket ${socket.id}`
//       );
//     });

//     // Call-related socket handlers
//     socket.on("initiate-call", async (data) => {
//       const { callId, chatId, chatType, callType, chatName, initiator } = data;

//       // Store call data, including initiator in participants
//       activeCalls.set(callId, {
//         callId,
//         chatId,
//         chatType,
//         callType,
//         chatName,
//         initiator,
//         participants: new Map([
//           [
//             initiator.userId,
//             {
//               userId: initiator.userId,
//               socketId: socket.id,
//               name: initiator.name,
//               avatar: initiator.avatar,
//               joinedAt: new Date(),
//             },
//           ],
//         ]),
//         startTime: new Date(),
//         status: "calling",
//       });

//       userCalls.set(initiator.userId, callId);

//       // Notify target users (unchanged)
//       if (chatType === "channel") {
//         // Notify all channel members except initiator
//         try {
//           const channelMembers = await ChannelMember.findAll({
//             where: { channel_id: chatId },
//             include: [{ model: User, attributes: ["id", "name", "avatar"] }],
//           });

//           channelMembers.forEach((member) => {
//             if (member.user_id !== initiator.userId) {
//               const memberSocketId = userSockets.get(member.user_id);
//               if (memberSocketId) {
//                 io.to(`user_${member.user_id}`).emit("incoming-call", {
//                   callId,
//                   chatId,
//                   chatType,
//                   callType,
//                   chatName,
//                   initiator,
//                 });
//               }
//             }
//           });
//         } catch (error) {
//           console.error("Error notifying channel members:", error);
//         }
//       } else {
//         // Direct message call
//         io.to(`user_${chatId}`).emit("incoming-call", {
//           callId,
//           chatId,
//           chatType,
//           callType,
//           chatName,
//           initiator,
//         });
//       }

//       console.log(
//         `Call ${callId} initiated by ${initiator.userId} in ${chatType} ${chatId}`
//       );
//     });

//     // Replace your accept-call handler with this fixed version
//     socket.on("accept-call", async (data) => {
//       const { callId, user } = data;
//       const call = activeCalls.get(callId);

//       if (!call) {
//         console.error(`Call ${callId} not found`);
//         return;
//       }

//       // Add user to call participants
//       call.participants.set(user.userId, {
//         userId: user.userId,
//         socketId: socket.id,
//         name: user.name,
//         avatar: user.avatar,
//         joinedAt: new Date(),
//       });

//       userCalls.set(user.userId, callId);
//       call.status = "connected";

//       // Notify existing participants (including initiator) about the new joiner
//       call.participants.forEach((participant, participantId) => {
//         if (participantId !== user.userId) {
//           io.to(`user_${participantId}`).emit("call-accepted", {
//             callId,
//             userId: user.userId,
//             user,
//           });
//         }
//       });

//       // Send complete participant sync to the new joiner
//       io.to(socket.id).emit("call-participants-sync", {
//         callId,
//         participants: Array.from(call.participants.entries()).map(
//           ([userId, participant]) => ({
//             userId,
//             socketId: participant.socketId,
//             name: participant.name,
//             avatar: participant.avatar,
//             joinedAt: participant.joinedAt,
//           })
//         ),
//       });

//       console.log(`User ${user.userId} accepted call ${callId}`);
//       console.log(
//         `Synced ${call.participants.size} participants to new joiner`
//       );
//     });

//     socket.on("decline-call", async (data) => {
//       const { callId } = data;
//       const call = activeCalls.get(callId);

//       if (call) {
//         const userId = socket.userId;

//         if (call.chatType === "dm") {
//           // For DM, decline ends the call
//           // Notify initiator about the decline
//           io.to(`user_${call.initiator.userId}`).emit("call-declined", {
//             callId,
//           });

//           // Notify any other participants (though in DM, unlikely)
//           call.participants.forEach((participant) => {
//             if (participant.userId !== call.initiator.userId) {
//               io.to(`user_${participant.userId}`).emit("call-ended", {
//                 callId,
//               });
//             }
//             userCalls.delete(participant.userId);
//           });

//           // Clean up call
//           activeCalls.delete(callId);
//           userCalls.delete(call.initiator.userId);
//         } else {
//           // For channel, just notify initiator of the decline, call continues
//           io.to(`user_${call.initiator.userId}`).emit("call-declined", {
//             callId,
//             userId,
//           });
//           // Do not end the call
//         }
//       }

//       console.log(`Call ${callId} declined by user ${socket.userId}`);
//     });

//     // Replace your existing "end-call" handler with this improved version
//     socket.on("end-call", async (data) => {
//       const { callId } = data;
//       const userId = socket.userId;
//       const call = activeCalls.get(callId);

//       if (!call) {
//         console.log(`Call ${callId} not found`);
//         return;
//       }

//       // Remove the leaving user from participants
//       call.participants.delete(userId);
//       userCalls.delete(userId);

//       // Determine if we should end the entire call (fewer than 2 participants remaining)
//       const shouldEndCall = call.participants.size < 2;

//       if (shouldEndCall) {
//         // End the entire call
//         console.log(
//           `Ending call ${callId} - fewer than 2 participants remaining`
//         );

//         // Notify all remaining participants that call has ended
//         call.participants.forEach((participant) => {
//           io.to(`user_${participant.userId}`).emit("call-ended", { callId });
//           userCalls.delete(participant.userId);
//         });

//         // For channel calls, notify all channel members who might have pending call notifications
//         if (call.chatType === "channel") {
//           try {
//             const channelMembers = await ChannelMember.findAll({
//               where: { channel_id: call.chatId },
//               include: [{ model: User, attributes: ["id", "name", "avatar"] }],
//             });

//             channelMembers.forEach((member) => {
//               // Notify members who aren't already handled above
//               if (
//                 !call.participants.has(member.user_id) &&
//                 member.user_id !== call.initiator.userId
//               ) {
//                 io.to(`user_${member.user_id}`).emit("call-ended", { callId });
//                 userCalls.delete(member.user_id);
//               }
//             });
//           } catch (error) {
//             console.error(
//               "Error notifying channel members of call end:",
//               error
//             );
//           }
//         } else {
//           // Direct message call - notify the other user if they haven't joined
//           if (
//             call.chatId !== call.initiator.userId &&
//             !call.participants.has(call.chatId)
//           ) {
//             io.to(`user_${call.chatId}`).emit("call-ended", { callId });
//             userCalls.delete(call.chatId);
//           }
//         }

//         // Clean up the call completely
//         activeCalls.delete(callId);
//       } else {
//         // Just remove this participant from the ongoing call
//         console.log(`User ${userId} left call ${callId}, but call continues`);

//         // Notify remaining participants that this user left
//         call.participants.forEach((participant) => {
//           io.to(`user_${participant.userId}`).emit("participant-left", {
//             callId,
//             userId,
//             remainingParticipants: Array.from(call.participants.keys()),
//           });
//         });

//         // Update the call in activeCalls (participants already updated above)
//         activeCalls.set(callId, call);
//       }

//       console.log(
//         `Call ${callId} - User ${userId} ${
//           shouldEndCall ? "ended call" : "left call"
//         }`
//       );
//     });

//     // WebRTC signaling
//     socket.on("webrtc-offer", (data) => {
//       const { callId, targetUserId, offer } = data;
//       const fromUserId = socket.userId;

//       io.to(`user_${targetUserId}`).emit("webrtc-offer", {
//         callId,
//         fromUserId,
//         offer,
//       });
//     });

//     socket.on("webrtc-answer", (data) => {
//       const { callId, targetUserId, answer } = data;
//       const fromUserId = socket.userId;

//       io.to(`user_${targetUserId}`).emit("webrtc-answer", {
//         callId,
//         fromUserId,
//         answer,
//       });
//     });

//     socket.on("ice-candidate", (data) => {
//       const { callId, targetUserId, candidate } = data;
//       const fromUserId = socket.userId;

//       io.to(`user_${targetUserId}`).emit("ice-candidate", {
//         callId,
//         fromUserId,
//         candidate,
//       });
//     });

//     // Call control events
//     socket.on("toggle-video", (data) => {
//       const { callId, isVideoEnabled } = data;
//       const userId = socket.userId;
//       const call = activeCalls.get(callId);

//       if (call) {
//         // Notify other participants
//         call.participants.forEach((participant) => {
//           if (participant.userId !== userId) {
//             io.to(`user_${participant.userId}`).emit(
//               "participant-toggle-video",
//               {
//                 callId,
//                 userId,
//                 isVideoEnabled,
//               }
//             );
//           }
//         });
//       }
//     });

//     socket.on("toggle-audio", (data) => {
//       const { callId, isAudioEnabled } = data;
//       const userId = socket.userId;
//       const call = activeCalls.get(callId);

//       if (call) {
//         // Notify other participants
//         call.participants.forEach((participant) => {
//           if (participant.userId !== userId) {
//             io.to(`user_${participant.userId}`).emit(
//               "participant-toggle-audio",
//               {
//                 callId,
//                 userId,
//                 isAudioEnabled,
//               }
//             );
//           }
//         });
//       }
//     });

//     // Existing handlers (status, messages, etc.)
//     socket.on("set-away", () => {
//       const userId = socket.userId;
//       if (userId) {
//         userStatus.set(userId, {
//           status: "away",
//           lastSeen: new Date().toISOString(),
//         });
//         socket.broadcast.emit("user-status-update", {
//           userId,
//           status: "away",
//         });
//         console.log(`User ${userId} is away`);
//       }
//     });

//     socket.on("set-online", () => {
//       const userId = socket.userId;
//       if (userId) {
//         userStatus.set(userId, { status: "online", lastSeen: null });
//         socket.broadcast.emit("user-status-update", {
//           userId,
//           status: "online",
//         });
//         console.log(`User ${userId} is back online`);
//       }
//     });

//     socket.on("member-added-to-channel", ({ channelId, userIds, channel }) => {
//       // Notify all added members
//       userIds.forEach((userId) => {
//         io.to(`user_${userId}`).emit("channel-added", channel);

//         // Ensure they join the channel room
//         const memberSocketId = userSockets.get(userId);
//         if (memberSocketId) {
//           const memberSocket = io.sockets.sockets.get(memberSocketId);
//           if (memberSocket) {
//             memberSocket.join(`channel_${channelId}`);
//             console.log(
//               `User ${userId} auto-joined channel_${channelId} after being added`
//             );
//           }
//         }
//       });

//       // Notify existing channel members about new members
//       io.to(`channel_${channelId}`).emit("members-added", {
//         channelId,
//         newMemberIds: userIds,
//       });
//     });

//     socket.on("join-channel", (channelId) => {
//       socket.join(`channel_${channelId}`);
//       console.log(`Socket ${socket.id} joined channel ${channelId}`);
//     });

//     socket.on("typing", (data) => {
//       if (data.channelId) {
//         // Channel typing - broadcast to channel members only (exclude sender)
//         socket.to(`channel_${data.channelId}`).emit("typing", {
//           channelId: data.channelId,
//           userId: data.userId,
//           userName: data.userName,
//           isTyping: data.isTyping,
//         });
//         console.log(`Typing indicator sent to channel_${data.channelId}`);
//       } else if (data.recipientId && data.senderId) {
//         // Direct message typing - send to recipient's personal room
//         io.to(`user_${data.recipientId}`).emit("typing", {
//           senderId: data.senderId,
//           recipientId: data.recipientId,
//           userId: data.userId,
//           userName: data.userName,
//           isTyping: data.isTyping,
//         });
//         console.log(
//           `Direct typing indicator sent from user_${data.senderId} to user_${data.recipientId}`
//         );
//       }
//     });

//     socket.on("message-delivered", async ({ messageId, senderId }) => {
//       const userId = socket.userId;
//       if (!userId || !messageId) return;

//       const [affectedCount] = await MessageStatus.update(
//         { status: "delivered" },
//         {
//           where: {
//             message_id: messageId,
//             status: "sent",
//           },
//         }
//       );

//       if (affectedCount > 0) {
//         io.to(`user_${senderId}`).emit("message-status-updated", {
//           messageId,
//           status: "delivered",
//         });
//       }
//     });

//     socket.on("message-seen", async ({ messageIds, userId }) => {
//       if (!Array.isArray(messageIds) || !socket.userId) return;

//       await MessageStatus.update(
//         { status: "seen" },
//         {
//           where: {
//             message_id: messageIds,
//             user_id: socket.userId,
//             status: { [Op.ne]: "seen" },
//           },
//         }
//       );

//       messageIds.forEach((messageId) => {
//         io.to(`user_${userId}`).emit("message-status-updated", {
//           messageId,
//           userId: socket.userId,
//           status: "seen",
//         });
//       });
//     });

//     socket.on("mark-messages-read", async ({ chatId, type }) => {
//       const userId = socket.userId;
//       if (!userId) return;

//       try {
//         if (type === "channel") {
//           await MessageStatus.update(
//             { status: "seen" },
//             {
//               where: {
//                 user_id: userId,
//                 status: { [Op.ne]: "seen" },
//               },
//               include: [
//                 {
//                   model: Message,
//                   where: { channel_id: chatId },
//                 },
//               ],
//             }
//           );
//         } else {
//           await MessageStatus.update(
//             { status: "seen" },
//             {
//               where: {
//                 user_id: userId,
//                 status: { [Op.ne]: "seen" },
//               },
//               include: [
//                 {
//                   model: Message,
//                   where: {
//                     [Op.or]: [
//                       { sender_id: chatId, recipient_id: userId },
//                       { sender_id: userId, recipient_id: chatId },
//                     ],
//                   },
//                 },
//               ],
//             }
//           );
//         }

//         if (type === "dm") {
//           io.to(`user_${chatId}`).emit("messages-read", {
//             readerId: userId,
//           });
//         } else {
//           const channelMembers = await ChannelMember.findAll({
//             where: { channel_id: chatId },
//             attributes: ["user_id"],
//           });

//           channelMembers.forEach((member) => {
//             if (member.user_id !== userId) {
//               io.to(`user_${member.user_id}`).emit("messages-read", {
//                 channelId: chatId,
//                 readerId: userId,
//               });
//             }
//           });
//         }
//       } catch (error) {
//         console.error("Error marking messages as read:", error);
//       }
//     });

//     socket.on("disconnect", () => {
//       const userId = socketUsers.get(socket.id);
//       if (userId) {
//         const callId = userCalls.get(userId);
//         if (callId) {
//           const call = activeCalls.get(callId);
//           if (call) {
//             // Remove from participants
//             call.participants.delete(userId);

//             // Determine if we should end the entire call
//             const shouldEndCall = call.participants.size < 2;

//             if (shouldEndCall) {
//               // End entire call
//               call.participants.forEach((participant) => {
//                 io.to(`user_${participant.userId}`).emit("call-ended", {
//                   callId,
//                 });
//                 userCalls.delete(participant.userId);
//               });

//               activeCalls.delete(callId);
//             } else {
//               // Just notify others that participant left
//               call.participants.forEach((participant) => {
//                 io.to(`user_${participant.userId}`).emit("participant-left", {
//                   callId,
//                   userId,
//                   remainingParticipants: Array.from(call.participants.keys()),
//                 });
//               });
//             }
//           }
//           userCalls.delete(userId);
//         }

//         // Clean up user mappings and status
//         userSockets.delete(userId);
//         socketUsers.delete(socket.id);
//         userStatus.set(userId, {
//           status: "offline",
//           lastSeen: new Date().toISOString(),
//         });

//         socket.broadcast.emit("user-status-update", {
//           userId,
//           status: "offline",
//         });

//         console.log(`User ${userId} disconnected`);
//       }
//     });
//   });
// };


module.exports = function initSockets(io) {
  // Store user socket mappings
  const userSockets = new Map(); // userId -> socketId
  const socketUsers = new Map(); // socketId -> userId
  const userStatus = new Map();

  // Call management
  const activeCalls = new Map(); // callId -> call data
  const userCalls = new Map(); // userId -> callId

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join-room", async (userId) => {
      const existingSocketId = userSockets.get(userId);
      if (existingSocketId && existingSocketId !== socket.id) {
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          existingSocket.disconnect(true);
        }
        socketUsers.delete(existingSocketId);
      }

      userSockets.set(userId, socket.id);
      socketUsers.set(socket.id, userId);
      socket.userId = userId;

      try {
        const userChannels = await ChannelMember.findAll({
          where: { user_id: userId },
          attributes: ["channel_id"],
        });

        userChannels.forEach((channelMember) => {
          socket.join(`channel_${channelMember.channel_id}`);
          console.log(
            `User ${userId} auto-joined channel_${channelMember.channel_id}`
          );
        });
      } catch (error) {
        console.error(`Error joining user ${userId} to channels:`, error);
      }

      socket.join(`user_${userId}`);
      userStatus.set(userId, { status: "online", lastSeen: null });

      const onlineUsers = [];
      for (const [uid, statusInfo] of userStatus.entries()) {
        if (statusInfo.status === "online" && uid !== userId) {
          onlineUsers.push({
            userId: uid,
            status: statusInfo.status,
          });
        }
      }

      if (onlineUsers.length > 0) {
        socket.emit("bulk-user-status-update", onlineUsers);
      }

      socket.broadcast.emit("user-status-update", {
        userId,
        status: "online",
      });

      const undeliveredStatuses = await MessageStatus.findAll({
        where: { status: "sent" },
        include: [{ model: Message, as: "message" }],
      });

      const messageIds = undeliveredStatuses.map((ms) => ms.message_id);

      if (messageIds.length > 0) {
        await MessageStatus.update(
          { status: "delivered" },
          { where: { message_id: messageIds, status: "sent" } }
        );

        for (const status of undeliveredStatuses) {
          const senderId = status.message.sender_id;
          io.to(`user_${senderId}`).emit("message-status-updated", {
            messageId: status.message_id,
            userId,
            status: "delivered",
          });
        }
      }

      console.log(
        `User ${userId} joined personal room user_${userId} with socket ${socket.id}`
      );
    });

    socket.on("initiate-call", async (data) => {
      const { callId, chatId, chatType, callType, chatName, initiator } = data;

      activeCalls.set(callId, {
        callId,
        chatId,
        chatType,
        callType,
        chatName,
        initiator,
        participants: new Map([
          [
            initiator.userId,
            {
              userId: initiator.userId,
              socketId: socket.id,
              name: initiator.name,
              avatar: initiator.avatar,
              joinedAt: new Date(),
            },
          ],
        ]),
        startTime: new Date(),
        status: "calling",
      });

      userCalls.set(initiator.userId, callId);

      if (chatType === "channel") {
        try {
          const channelMembers = await ChannelMember.findAll({
            where: { channel_id: chatId },
            include: [{ model: User, attributes: ["id", "name", "avatar"] }],
          });

          channelMembers.forEach((member) => {
            if (member.user_id !== initiator.userId) {
              const memberSocketId = userSockets.get(member.user_id);
              if (memberSocketId) {
                io.to(`user_${member.user_id}`).emit("incoming-call", {
                  callId,
                  chatId,
                  chatType,
                  callType,
                  chatName,
                  initiator,
                });
              }
            }
          });
        } catch (error) {
          console.error("Error notifying channel members:", error);
        }
      } else {
        io.to(`user_${chatId}`).emit("incoming-call", {
          callId,
          chatId,
          chatType,
          callType,
          chatName,
          initiator,
        });
      }

      console.log(
        `Call ${callId} initiated by ${initiator.userId} in ${chatType} ${chatId}`
      );
    });

    socket.on("accept-call", async (data) => {
      const { callId, user } = data;
      const call = activeCalls.get(callId);

      if (!call) {
        console.error(`Call ${callId} not found`);
        return;
      }

      call.participants.set(user.userId, {
        userId: user.userId,
        socketId: socket.id,
        name: user.name,
        avatar: user.avatar,
        joinedAt: new Date(),
      });

      userCalls.set(user.userId, callId);
      call.status = "connected";

      call.participants.forEach((participant, participantId) => {
        if (participantId !== user.userId) {
          io.to(`user_${participantId}`).emit("call-accepted", {
            callId,
            userId: user.userId,
            user,
          });
        }
      });

      io.to(socket.id).emit("call-participants-sync", {
        callId,
        participants: Array.from(call.participants.entries()).map(
          ([userId, participant]) => ({
            userId,
            socketId: participant.socketId,
            name: participant.name,
            avatar: participant.avatar,
            joinedAt: participant.joinedAt,
          })
        ),
      });

      console.log(`User ${user.userId} accepted call ${callId}`);
      console.log(
        `Synced ${call.participants.size} participants to new joiner`
      );
    });

    socket.on("decline-call", async (data) => {
      const { callId } = data;
      const userId = socket.userId;
      const call = activeCalls.get(callId);

      if (!call) {
        console.log(`Call ${callId} not found`);
        return;
      }

      if (call.chatType === "dm") {
        // For DM, decline ends the call
        io.to(`user_${call.initiator.userId}`).emit("call-declined", {
          callId,
          userId,
        });

        call.participants.forEach((participant) => {
          if (participant.userId !== call.initiator.userId) {
            io.to(`user_${participant.userId}`).emit("call-ended", { callId });
            userCalls.delete(participant.userId);
          }
        });

        activeCalls.delete(callId);
        userCalls.delete(call.initiator.userId);
      } else {
        // For channel calls, notify initiator of decline but keep call active
        io.to(`user_${call.initiator.userId}`).emit("call-declined", {
          callId,
          userId,
        });

        // Only end call if fewer than 2 participants remain
        if (call.participants.size < 2) {
          call.participants.forEach((participant) => {
            io.to(`user_${participant.userId}`).emit("call-ended", { callId });
            userCalls.delete(participant.userId);
          });

          activeCalls.delete(callId);
          console.log(`Call ${callId} ended due to insufficient participants`);
        } else {
          console.log(
            `Call ${callId} continues despite decline by user ${userId}`
          );
        }
      }

      console.log(`Call ${callId} declined by user ${userId}`);
    });

    socket.on("end-call", async (data) => {
      const { callId } = data;
      const userId = socket.userId;
      const call = activeCalls.get(callId);

      if (!call) {
        console.log(`Call ${callId} not found`);
        return;
      }

      call.participants.delete(userId);
      userCalls.delete(userId);

      const shouldEndCall = call.participants.size < 2;

      if (shouldEndCall) {
        console.log(
          `Ending call ${callId} - fewer than 2 participants remaining`
        );

        call.participants.forEach((participant) => {
          io.to(`user_${participant.userId}`).emit("call-ended", { callId });
          userCalls.delete(participant.userId);
        });

        if (call.chatType === "channel") {
          try {
            const channelMembers = await ChannelMember.findAll({
              where: { channel_id: call.chatId },
              include: [{ model: User, attributes: ["id", "name", "avatar"] }],
            });

            channelMembers.forEach((member) => {
              if (!call.participants.has(member.user_id)) {
                io.to(`user_${member.user_id}`).emit("call-ended", { callId });
                userCalls.delete(member.user_id);
              }
            });
          } catch (error) {
            console.error(
              "Error notifying channel members of call end:",
              error
            );
          }
        } else {
          if (
            call.chatId !== call.initiator.userId &&
            !call.participants.has(call.chatId)
          ) {
            io.to(`user_${call.chatId}`).emit("call-ended", { callId });
            userCalls.delete(call.chatId);
          }
        }

        activeCalls.delete(callId);
      } else {
        console.log(`User ${userId} left call ${callId}, but call continues`);

        call.participants.forEach((participant) => {
          io.to(`user_${participant.userId}`).emit("participant-left", {
            callId,
            userId,
            remainingParticipants: Array.from(call.participants.keys()),
          });
        });

        activeCalls.set(callId, call);
      }

      console.log(
        `Call ${callId} - User ${userId} ${
          shouldEndCall ? "ended call" : "left call"
        }`
      );
    });

    socket.on("webrtc-offer", (data) => {
      const { callId, targetUserId, offer } = data;
      const fromUserId = socket.userId;

      io.to(`user_${targetUserId}`).emit("webrtc-offer", {
        callId,
        fromUserId,
        offer,
      });
    });

    socket.on("webrtc-answer", (data) => {
      const { callId, targetUserId, answer } = data;
      const fromUserId = socket.userId;

      io.to(`user_${targetUserId}`).emit("webrtc-answer", {
        callId,
        fromUserId,
        answer,
      });
    });

    socket.on("ice-candidate", (data) => {
      const { callId, targetUserId, candidate } = data;
      const fromUserId = socket.userId;

      io.to(`user_${targetUserId}`).emit("ice-candidate", {
        callId,
        fromUserId,
        candidate,
      });
    });

    socket.on("toggle-video", (data) => {
      const { callId, isVideoEnabled } = data;
      const userId = socket.userId;
      const call = activeCalls.get(callId);

      if (call) {
        call.participants.forEach((participant) => {
          if (participant.userId !== userId) {
            io.to(`user_${participant.userId}`).emit(
              "participant-toggle-video",
              {
                callId,
                userId,
                isVideoEnabled,
              }
            );
          }
        });
      }
    });

    socket.on("toggle-audio", (data) => {
      const { callId, isAudioEnabled } = data;
      const userId = socket.userId;
      const call = activeCalls.get(callId);

      if (call) {
        call.participants.forEach((participant) => {
          if (participant.userId !== userId) {
            io.to(`user_${participant.userId}`).emit(
              "participant-toggle-audio",
              {
                callId,
                userId,
                isAudioEnabled,
              }
            );
          }
        });
      }
    });

    socket.on("set-away", () => {
      const userId = socket.userId;
      if (userId) {
        userStatus.set(userId, {
          status: "away",
          lastSeen: new Date().toISOString(),
        });
        socket.broadcast.emit("user-status-update", {
          userId,
          status: "away",
        });
        console.log(`User ${userId} is away`);
      }
    });

    socket.on("set-online", () => {
      const userId = socket.userId;
      if (userId) {
        userStatus.set(userId, { status: "online", lastSeen: null });
        socket.broadcast.emit("user-status-update", {
          userId,
          status: "online",
        });
        console.log(`User ${userId} is back online`);
      }
    });

    socket.on("member-added-to-channel", ({ channelId, userIds, channel }) => {
      userIds.forEach((userId) => {
        io.to(`user_${userId}`).emit("channel-added", channel);
        const memberSocketId = userSockets.get(userId);
        if (memberSocketId) {
          const memberSocket = io.sockets.sockets.get(memberSocketId);
          if (memberSocket) {
            memberSocket.join(`channel_${channelId}`);
            console.log(
              `User ${userId} auto-joined channel_${channelId} after being added`
            );
          }
        }
      });

      io.to(`channel_${channelId}`).emit("members-added", {
        channelId,
        newMemberIds: userIds,
      });
    });

    socket.on("join-channel", (channelId) => {
      socket.join(`channel_${channelId}`);
      console.log(`Socket ${socket.id} joined channel ${channelId}`);
    });

    socket.on("typing", (data) => {
      if (data.channelId) {
        socket.to(`channel_${data.channelId}`).emit("typing", {
          channelId: data.channelId,
          userId: data.userId,
          userName: data.userName,
          isTyping: data.isTyping,
        });
        console.log(`Typing indicator sent to channel_${data.channelId}`);
      } else if (data.recipientId && data.senderId) {
        io.to(`user_${data.recipientId}`).emit("typing", {
          senderId: data.senderId,
          recipientId: data.recipientId,
          userId: data.userId,
          userName: data.userName,
          isTyping: data.isTyping,
        });
        console.log(
          `Direct typing indicator sent from user_${data.senderId} to user_${data.recipientId}`
        );
      }
    });

    socket.on("message-delivered", async ({ messageId, senderId }) => {
      const userId = socket.userId;
      if (!userId || !messageId) return;

      const [affectedCount] = await MessageStatus.update(
        { status: "delivered" },
        { where: { message_id: messageId, status: "sent" } }
      );

      if (affectedCount > 0) {
        io.to(`user_${senderId}`).emit("message-status-updated", {
          messageId,
          status: "delivered",
        });
      }
    });

    socket.on("message-seen", async ({ messageIds, userId }) => {
      if (!Array.isArray(messageIds) || !socket.userId) return;

      await MessageStatus.update(
        { status: "seen" },
        {
          where: {
            message_id: messageIds,
            user_id: socket.userId,
            status: { [Op.ne]: "seen" },
          },
        }
      );

      messageIds.forEach((messageId) => {
        io.to(`user_${userId}`).emit("message-status-updated", {
          messageId,
          userId: socket.userId,
          status: "seen",
        });
      });
    });

    socket.on("mark-messages-read", async ({ chatId, type }) => {
      const userId = socket.userId;
      if (!userId) return;

      try {
        if (type === "channel") {
          await MessageStatus.update(
            { status: "seen" },
            {
              where: { user_id: userId, status: { [Op.ne]: "seen" } },
              include: [{ model: Message, where: { channel_id: chatId } }],
            }
          );
        } else {
          await MessageStatus.update(
            { status: "seen" },
            {
              where: { user_id: userId, status: { [Op.ne]: "seen" } },
              include: [
                {
                  model: Message,
                  where: {
                    [Op.or]: [
                      { sender_id: chatId, recipient_id: userId },
                      { sender_id: userId, recipient_id: chatId },
                    ],
                  },
                },
              ],
            }
          );
        }

        if (type === "dm") {
          io.to(`user_${chatId}`).emit("messages-read", { readerId: userId });
        } else {
          const channelMembers = await ChannelMember.findAll({
            where: { channel_id: chatId },
            attributes: ["user_id"],
          });

          channelMembers.forEach((member) => {
            if (member.user_id !== userId) {
              io.to(`user_${member.user_id}`).emit("messages-read", {
                channelId: chatId,
                readerId: userId,
              });
            }
          });
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    socket.on("disconnect", () => {
      const userId = socketUsers.get(socket.id);
      if (userId) {
        const callId = userCalls.get(userId);
        if (callId) {
          const call = activeCalls.get(callId);
          if (call) {
            call.participants.delete(userId);
            const shouldEndCall = call.participants.size < 2;

            if (shouldEndCall) {
              call.participants.forEach((participant) => {
                io.to(`user_${participant.userId}`).emit("call-ended", {
                  callId,
                });
                userCalls.delete(participant.userId);
              });
              activeCalls.delete(callId);
            } else {
              call.participants.forEach((participant) => {
                io.to(`user_${participant.userId}`).emit("participant-left", {
                  callId,
                  userId,
                  remainingParticipants: Array.from(call.participants.keys()),
                });
              });
            }
          }
          userCalls.delete(userId);
        }

        userSockets.delete(userId);
        socketUsers.delete(socket.id);
        userStatus.set(userId, { status: "offline", lastSeen: new Date().toISOString() });

        socket.broadcast.emit("user-status-update", {
          userId,
          status: "offline",
        });

        console.log(`User ${userId} disconnected`);
      }
    });
  });
};
