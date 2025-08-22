module.exports = (sequelize, DataTypes) => {
  const MutedChat = sequelize.define('MutedChat', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    target_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    target_type: {
      type: DataTypes.ENUM('user', 'channel'),
      allowNull: false,
    },
    muted_until: {
      type: DataTypes.DATE,
      allowNull: true, // null means indefinitely muted
    }
  }, {
    tableName: 'muted_chats',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'target_id', 'target_type'],
      }
    ]
  });

  MutedChat.associate = models => {
    MutedChat.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });

    MutedChat.belongsTo(models.Channel, {
      foreignKey: 'target_id',
      constraints: false,
      as: 'mutedChannel',
    });

    MutedChat.belongsTo(models.User, {
      foreignKey: 'target_id',
      constraints: false,
      as: 'mutedUser',
    });

  };

  return MutedChat;
};
