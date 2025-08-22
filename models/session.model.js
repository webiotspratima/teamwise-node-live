module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    session_token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    device_info: {
      type: DataTypes.STRING, // e.g. "Chrome on Windows 11"
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING, // Save IP from request
      allowNull: true
    },
    agenda: {
      type: DataTypes.STRING, // e.g. "login", "api access", "token refresh"
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
      tableName: 'sessions', // <- manually set table name
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
  });

  Session.associate = models => {
    Session.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return Session;
};
