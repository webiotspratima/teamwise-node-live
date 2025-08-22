const jwt = require('jsonwebtoken');
const { User, TeamMember } = require('../models');

// Authenticate and attach user
exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'Invalid token: user not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('JWT error:', err);
    return res.status(403).json({ message: 'Token is invalid or expired' });
  }
};

exports.authorizeRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
};

// Middleware for team-based authorization, with super admin support
exports.authorizeTeamRole = (allowedRoles = []) => {
  return async (req, res, next) => {

    const teamId = req.header("X-Team-ID");

    if (!teamId || isNaN(teamId)) {
      return res
        .status(400)
        .json({ message: "Missing or invalid X-Team-ID header" });
    }

    req.team_id = teamId;

    // Super admin bypass
    if (req.user.role === 'super_admin') {
      req.team_role = 'admin';
      return next();
    }

    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'Forbidden: not a valid team user' });
    }

    try {
      const membership = await TeamMember.findOne({
        where: { team_id: teamId, user_id: req.user.id }
      });

      if (!membership) {
        return res.status(403).json({ message: 'User is not part of this team' });
      }

      req.team_role = membership.role;

      if (!allowedRoles.includes(membership.role)) {
        return res.status(403).json({ message: 'Forbidden: insufficient team permissions' });
      }

      next();
    } catch (err) {
      console.error('Team role check error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
};