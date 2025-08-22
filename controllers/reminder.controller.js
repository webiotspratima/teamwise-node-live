const { Reminder, Message } = require('../models');

exports.setReminder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { channel_id, recipient_id, message_id, remind_at, note } = req.body;

        if (!remind_at) return res.status(400).json({ message: "remind_at is required." });

        const reminder = await Reminder.create({
            user_id: userId,
            channel_id: channel_id || null,
            message_id: message_id || null,
            remind_at,
            note
        });

        const reminderMessage = await Message.create({
            sender_id: userId,
            channel_id: channel_id || null,
            recipient_id: recipient_id || null,
            message_type: 'reminder',
            content: note || 'Reminder set',
            metadata: {
                remind_at,
                reminder_id: reminder.id
            }
        });

        const io = req.app.get("io");
        if (channel_id) {
            io.to(`channel_${channel_id}`).emit("new-message", { message: reminderMessage });
        } else if (recipient_id) {
            io.to(`user_${recipient_id}`).emit("new-message", { message: reminderMessage });
        } else {
            io.to(`user_${userId}`).emit("new-message", { message: reminderMessage });
        }

        res.status(200).json({ message: "Reminder set successfully", reminder, reminderMessage });

    } catch (err) {
        console.error("Error in setReminder:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.cancelReminder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reminder_id } = req.body;

        const reminder = await Reminder.findOne({ where: { id: reminder_id, user_id: userId } });
        if (!reminder) return res.status(404).json({ message: "Reminder not found" });

        const msg = await Message.findOne({
            where: { message_type: 'reminder' },
        });

        if (msg) await msg.destroy();

        await reminder.destroy();

        const io = req.app.get("io");
        if (reminder.channel_id) {
            io.to(`channel_${reminder.channel_id}`).emit("reminder-canceled", { reminder_id });
        } else {
            io.to(`user_${userId}`).emit("reminder-canceled", { reminder_id });
        }

        res.status(200).json({ message: "Reminder cancelled successfully" });

    } catch (err) {
        console.error("Error in cancelReminder:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};
