const { Op,where: whereFn, fn, col } = require('sequelize');
const { CustomField, Team, TeamMember } = require('../models');

exports.createCustomField = async (req, res) => {
  const { field_name, description, value, is_user_add_value, parent_field_condition, is_mandatory, is_user_editable } = req.body;

  if (!field_name) {
    return res
      .status(400)
      .json({ message: "Field name is required." });
  }

  try {
    const team = await Team.findByPk(req.team_id);
    if (!team) {
      return res.status(404).json({ message: "Team not found." });
    }

    const newField = await CustomField.create({
      team_id: req.team_id,
      field_name,
      description,
      value,
      is_user_add_value,
      parent_field_condition,
      is_mandatory,
      is_user_editable,
    });

    return res.status(201).json({ message: "Custom field created successfully.", field: newField });
  } catch (err) {
    console.error("Error in createCustomField:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.getCustomFields = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = ''
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Base where condition
    const where = {
      team_id: req.team_id
    };

    // Search on field name (case-insensitive)
    if (search) {
      where[Op.and] = [
        whereFn(fn('LOWER', col('CustomField.field_name')), {
          [Op.like]: `%${search.toLowerCase()}%`
        })
      ];
    }

    // Get total count + paginated results
    const { rows: fields, count: total } = await CustomField.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      fields
    });

  } catch (err) {
    console.error("Error in getCustomFields:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.updateCustomField = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const field = await CustomField.findByPk(id);
    if (!field) {
      return res.status(404).json({ message: "Custom field not found." });
    }

    await field.update(updates);
    return res.status(200).json({ message: "Field updated successfully.", field });
  } catch (err) {
    console.error("Error in updateCustomField:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.deleteCustomField = async (req, res) => {
  const { id } = req.params;

  try {
    const field = await CustomField.findByPk(id);
    if (!field) {
      return res.status(404).json({ message: "Custom field not found." });
    }

    await field.destroy();
    return res.status(200).json({ message: "Field deleted successfully." });
  } catch (err) {
    console.error("Error in deleteCustomField:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.updateUserValue = async (req, res) => {
  try {
    const { value } = req.body;

    const member = await TeamMember.findOne({ where: { user_id: req.user?.id, team_id: req.team_id } });
    
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    await member.update({
      custom_field: value
    });

    return res.status(200).json({ message: 'Custom field updated successfully', settings });

  } catch (err) {
    console.error("Error in updateUserValue:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};