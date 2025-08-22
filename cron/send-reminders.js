const cron = require('node-cron');
const { Reminder, Message } = require('../models');
const { Op } = require('sequelize');

async function sendDueReminders(io) {
    const now = new Date();
    const dueReminders = await Reminder.findAll({
        where: { is_sent: false, remind_at: { [Op.lte]: now } }
    });

    for (const reminder of dueReminders) {
        // Optionally insert a system message when reminder triggers
        const firedMsg = await Message.create({
            sender_id: null, // system
            channel_id: reminder.channel_id || null,
            recipient_id: reminder.channel_id ? null : reminder.user_id,
            message_type: 'reminder',
            content: `Reminder: ${reminder.note || ''}`,
            metadata: { reminder_id: reminder.id, fired: true }
        });

        if (reminder.channel_id) {
            io.to(`channel_${reminder.channel_id}`).emit("reminder-fired", { reminder_id: reminder.id, note: reminder.note });
            io.to(`channel_${reminder.channel_id}`).emit("receive-message", { fullMessage: firedMsg });
        } else {
            io.to(`user_${reminder.user_id}`).emit("reminder-fired", { reminder_id: reminder.id, note: reminder.note });
            io.to(`user_${reminder.user_id}`).emit("receive-message", { fullMessage: firedMsg });
        }

        reminder.is_sent = true;
        await reminder.save();
    }
}

module.exports = (io) => {
    cron.schedule('* * * * *', async () => {
        await sendDueReminders(io);
    });
};
