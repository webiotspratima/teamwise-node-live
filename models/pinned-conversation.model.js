module.exports = (sequelize, DataTypes) => {
  const PinnedConversation = sequelize.define('PinnedConversation', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('channel', 'dm'),
      allowNull: false,
    },
    target_id: {
      type: DataTypes.BIGINT,
      allowNull: false, // channel_id or other_user_id
    },
    pinned_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    }
  }, {
    tableName: 'pinned_conversations',
    timestamps: false,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return PinnedConversation;
};
