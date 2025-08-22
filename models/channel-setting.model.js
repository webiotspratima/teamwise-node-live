module.exports = (sequelize, DataTypes) => {
  const ChannelSetting = sequelize.define(
    'ChannelSetting',
    {
      channel_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'channels', key: 'id' },
        onDelete: 'CASCADE',
      },
      allow_posting: {
        type: DataTypes.ENUM('all', 'admin'),
        defaultValue: 'all',
      },
      file_sharing: {
        type: DataTypes.ENUM('all', 'admin', 'none'),
        defaultValue: 'all',
      },
      allow_mentions: {
        type: DataTypes.ENUM('all', 'admin'),
        defaultValue: 'all',
      },
      message_retention_days: {
        type: DataTypes.INTEGER,
        defaultValue: 90,
      }
    },
    {
      tableName: 'channel_settings',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ChannelSetting.associate = (models) => {
    ChannelSetting.belongsTo(models.Channel, { foreignKey: 'channel_id' });
  };

  return ChannelSetting;
};
