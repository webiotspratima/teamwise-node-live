module.exports = (sequelize, DataTypes) => {
  const ChannelMember = sequelize.define('ChannelMember', {
    channel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'channels', key: 'id' },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    role: {
      type: DataTypes.ENUM('admin', 'member'),
      defaultValue: 'member'
    }
  }, {
    tableName: 'channel_members',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  ChannelMember.associate = models => {
    ChannelMember.belongsTo(models.Channel, { foreignKey: 'channel_id' });
    ChannelMember.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return ChannelMember;
};
