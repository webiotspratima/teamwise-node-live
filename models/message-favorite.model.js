module.exports = (sequelize, DataTypes) => {
    const MessageFavorite = sequelize.define('MessageFavorite', {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
        },
        message_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: { model: 'messages', key: 'id' },
            onDelete: 'CASCADE',
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
        },
    }, {
        tableName: 'message_favorites',
        timestamps: true,
        indexes: [
            { name: 'idx_message_favorite', fields: ['message_id', 'user_id'], unique: true }
        ]
    });

    MessageFavorite.associate = (models) => {
        MessageFavorite.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message' });
        MessageFavorite.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    };
    return MessageFavorite;
};
