module.exports = (sequelize, DataTypes) => {
  const TeamMember = sequelize.define(
    'TeamMember',
    {
      team_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'teams', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      role: {
        type: DataTypes.ENUM('admin', 'member'),
        defaultValue: 'member',
      },
      display_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      custom_field: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'active', 'rejected', 'deactivated'),
        defaultValue: 'pending',
        allowNull: false
      },
    },
    {
      tableName: 'team_members',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TeamMember.associate = (models) => {
    TeamMember.belongsTo(models.Team, { foreignKey: 'team_id' });
    TeamMember.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return TeamMember;
};
