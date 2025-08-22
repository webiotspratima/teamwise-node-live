module.exports = (sequelize, DataTypes) => {
    const Reminder = sequelize.define(
        'Reminder',
        {
            id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            channel_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'channels', key: 'id' },
                onDelete: 'CASCADE',
            },
            message_id: {
                type: DataTypes.BIGINT,
                allowNull: true,
                references: { model: 'messages', key: 'id' },
                onDelete: 'CASCADE',
            },
            remind_at: { type: DataTypes.DATE, allowNull: false },
            note: { type: DataTypes.TEXT, allowNull: true },
            is_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
        },
        {
            tableName: 'reminders',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            paranoid: true,
            deletedAt: 'deleted_at',
            indexes: [
                { name: 'idx_user_remind', fields: ['user_id', 'remind_at'] },
                { name: 'idx_channel_remind', fields: ['channel_id', 'remind_at'] },
                { name: 'idx_is_sent', fields: ['is_sent'] }
            ],
        }
    );

    Reminder.associate = (models) => {
        Reminder.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        Reminder.belongsTo(models.Channel, { foreignKey: 'channel_id', as: 'channel' });
        Reminder.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message' });
    };

    return Reminder;
};
