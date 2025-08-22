module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
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
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM('super_admin', 'user'),
        defaultValue: 'user',
      },
      email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      last_login: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_online: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      last_seen: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'deactive'),
        defaultValue: 'active',
      },
    },
    {
      tableName: 'users',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  User.associate = (models) => {
    User.belongsToMany(models.Team, {
      through: models.TeamMember,
      foreignKey: 'user_id',
      otherKey: 'team_id',
    });

    User.belongsToMany(models.Channel, {
      through: models.ChannelMember,
      foreignKey: 'user_id',
      otherKey: 'channel_id',
    });

    
    User.hasMany(models.MessageStatus, { foreignKey: 'user_id' });

  };

  // Define a method to remove sensitive fields before serializing to JSON
  // User.prototype.toJSON = function () {
  //   const values = Object.assign({}, this.get());
  //   delete values.password;
  //   delete values.last_login;
  //   return values;
  // }

  return User;
};
