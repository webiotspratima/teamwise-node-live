const { User, Team, TeamMember } = require('../models');
const { Op, fn, col, where: whereFn } = require('sequelize');

exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      email_verified,
      from_date,
      to_date,
      has_last_login
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    // Search by name or email
    if (search) {
      where[Op.or] = [
        whereFn(fn('LOWER', col('User.name')), {
          [Op.like]: `%${search.toLowerCase()}%`
        }),
        whereFn(fn('LOWER', col('User.email')), {
          [Op.like]: `%${search.toLowerCase()}%`
        }),
      ];
    }

    if (role) where.role = role;
    if (email_verified !== undefined) where.email_verified = email_verified === 'true';

    if (from_date && to_date) {
      where.created_at = {
        [Op.between]: [new Date(from_date), new Date(to_date)],
      };
    }

    if (has_last_login === 'true') {
      where.last_login = { [Op.not]: null };
    } else if (has_last_login === 'false') {
      where.last_login = null;
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      attributes: ['id', 'avatar', 'name', 'email', 'country_code', 'phone', 'role', 'email_verified', 'last_login', 'status', 'created_at'],
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Team,
          attributes: ['id', 'name'],
          through: { attributes: ['role', 'status'] }
        }
      ]
    });

    return res.status(200).json({
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      users
    });

  } catch (err) {
    console.error('Error in getAllUsers:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, phone, country, country_code } = req.body;

  try {
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.update({ name, phone, country, country_code });
    return res.status(200).json({ message: 'User updated successfully', user });
  } catch (err) {
    console.error('Error in updateUser:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.update({ status: status });
    return res.status(200).json({ message: `User status update successfully` });
  } catch (err) {
    console.error('Error in updateUserStatus:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.destroy(); // soft delete enabled (paranoid: true)
    return res.status(200).json({ message: 'User deleted (soft) successfully' });
  } catch (err) {
    console.error('Error in deleteUser:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.removeUserFromTeam = async (req, res) => {
  const { teamId, userId } = req.params;

  try {
    const member = await TeamMember.findOne({ where: { team_id: teamId, user_id: userId } });

    if (!member) {
      return res.status(404).json({ message: 'Team membership not found' });
    }

    if (member.role === 'admin') {
      const totalAdmins = await TeamMember.count({
        where: {
          team_id: teamId,
          role: 'admin'
        }
      });

      if (totalAdmins <= 1) {
        return res.status(400).json({
          message: 'Cannot remove the last admin from the team'
        });
      }
    }

    await member.destroy();

    return res.status(200).json({ message: 'User removed from team successfully' });
  } catch (err) {
    console.error('Error in removeUserFromTeam:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
