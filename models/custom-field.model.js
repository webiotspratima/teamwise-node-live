module.exports = (sequelize, DataTypes) => {
  const CustomField = sequelize.define('CustomField', {
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
      onDelete: 'CASCADE',
    },
    field_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    value: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_user_add_value: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    parent_field_condition: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    is_mandatory: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_user_editable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    }
  }, {
    tableName: 'custom_fields',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  CustomField.associate = (models) => {
    CustomField.belongsTo(models.Team, { foreignKey: 'team_id' });
  };

  return CustomField;
};