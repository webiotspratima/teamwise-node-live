module.exports = (sequelize, DataTypes) => {
  const Setting = sequelize.define(
    'Setting',
    {
        app_name: {
            type: DataTypes.STRING
        },
        support_email: {
            type: DataTypes.STRING,
        },
        logo_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        smtp_host: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        smtp_port: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        smtp_user: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        smtp_pass: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        mail_from_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        mail_from_email: {
            type: DataTypes.STRING,
            allowNull: true,
        }
    },
    {
      tableName: 'settings',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return Setting;
};
