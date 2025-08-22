module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    'Message',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      sender_id: { 
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
      team_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'teams', key: 'id' },
        onDelete: 'CASCADE',
      },
      recipient_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      parent_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: { model: 'messages', key: 'id' },
        onDelete: 'CASCADE',
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      message_type: {
        type: DataTypes.ENUM('text', 'image', 'file', 'video', 'poll', 'form', 'system', 'reminder'),
        defaultValue: 'text',
      },
      file_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      file_type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Flexible field for polls, form schema, etc.
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'messages',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
      indexes: [
        {
          name: 'idx_channel_created_at',
          fields: ['channel_id', 'created_at'],
        },
        {
          name: 'idx_recipient_created_at',
          fields: ['recipient_id', 'created_at'],
        },
        {
          name: 'idx_parent_id',
          fields: ['parent_id'],
        },
        {
          name: 'idx_sender_id',
          fields: ['sender_id'],
        },
        {
          name: 'idx_message_type',
          fields: ['message_type'],
        },
      ],
    }
  );

  Message.associate = (models) => {
    Message.belongsTo(models.User, { foreignKey: 'sender_id', as: 'sender' });
    Message.belongsTo(models.Channel, { foreignKey: 'channel_id', as: 'channel' });
    Message.belongsTo(models.User, { foreignKey: 'recipient_id', as: 'recipient' });
    Message.belongsTo(models.Message, { foreignKey: 'parent_id', as: 'parent' });
    Message.hasMany(models.MessageStatus, { foreignKey: 'message_id', as: 'statuses' });
    Message.hasMany(models.MessageReaction, { foreignKey: 'message_id', as: 'reaction' });
    Message.hasMany(models.MessagePin, { foreignKey: 'message_id', as: 'pins' });
    Message.hasMany(models.MessageFavorite, { foreignKey: 'message_id', as: 'favorites' });
  };

  return Message;
};
