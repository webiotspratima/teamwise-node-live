module.exports = (sequelize, DataTypes) => {
  const Channel = sequelize.define('Channel', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('public', 'private'),
      defaultValue: 'public'
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
      onDelete: 'CASCADE'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL'
    }
  }, {
    tableName: 'channels',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Channel.associate = models => {
    Channel.belongsTo(models.Team, { foreignKey: 'team_id', as: 'team' });
    Channel.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });

    Channel.belongsToMany(models.User, {
      through: models.ChannelMember,
      foreignKey: 'channel_id',
      otherKey: 'user_id'
    });

    Channel.hasMany(models.Message, { as: 'messages', foreignKey: 'channel_id' });

    Channel.hasMany(models.ChannelMember, { foreignKey: 'channel_id', as: 'members' });
    Channel.hasOne(models.ChannelSetting, { foreignKey: 'channel_id', as: 'setting' });
  };


  return Channel;
};
