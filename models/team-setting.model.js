module.exports = (sequelize, DataTypes) => {
  const TeamSetting = sequelize.define(
    'TeamSetting',
    {
      team_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'teams', key: 'id' },
        onDelete: 'CASCADE',
      },
      require_approval_to_join: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      invite_only: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      approved_domains: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      block_all_other_domains: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      invitation_permission: {
        type: DataTypes.ENUM('all', 'admin'),
        defaultValue: 'admin',
      },
      email_notifications_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      direct_join_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      members_can_create_channels: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      message_retention_days: {
        type: DataTypes.INTEGER,
        defaultValue: 90,
      },
      notifications_default: {
        type: DataTypes.ENUM('all', 'mentions', 'none'),
        defaultValue: 'all',
      },
      public_channel_creation_permission: {
        type: DataTypes.ENUM('all', 'admin', 'specified_members'),
        defaultValue: 'all',
      },
      allowed_public_channel_creator_ids: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      private_channel_creation_permission: {
        type: DataTypes.ENUM('all', 'admin', 'specified_members'),
        defaultValue: 'admin',
      },
      allowed_private_channel_creator_ids: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      channel_creation_limit_per_user: {
        type: DataTypes.INTEGER,
        defaultValue: 20,
      },
      file_sharing_access: {
        type: DataTypes.ENUM('all', 'admin', 'specified_members'),
        defaultValue: 'admin',
      },
      file_sharing_type_scope: {
        type: DataTypes.ENUM('all', 'specified_types'),
        defaultValue: 'all',
      },
      allowed_file_upload_types: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      allowed_file_upload_member_ids: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      team_file_upload_limit_mb: {
        type: DataTypes.INTEGER,
        defaultValue: 1000,
      },
      member_file_upload_limit_mb: {
        type: DataTypes.INTEGER,
        defaultValue: 100,
      },
      timezone: {
        type: DataTypes.STRING,
        defaultValue: 'UTC',
      },
      visibility: {
        type: DataTypes.ENUM('public', 'private'),
        defaultValue: 'private',
      },
    },
    {
      tableName: 'team_settings',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TeamSetting.associate = (models) => {
    TeamSetting.belongsTo(models.Team, { foreignKey: 'team_id' });
  };

  return TeamSetting;
};
