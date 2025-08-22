module.exports = (sequelize, DataTypes) => {
  const Team = sequelize.define(
    "Team",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      avatar: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      domain: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL'
      }
    },
    {
      tableName: 'teams',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Team.associate = (models) => {
    Team.belongsToMany(models.User, {
      through: models.TeamMember,
      foreignKey: 'team_id',
      otherKey: 'user_id',
    });

    Team.hasMany(models.Channel, {
      foreignKey: 'team_id',
    });

    Team.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });

    Team.hasOne(models.TeamSetting, {
      foreignKey: 'team_id',
      as: 'team_setting'
    });
  };

  return Team;
};
