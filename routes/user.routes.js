const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const userController = require('../controllers/user.controller');

// Admin
router.get('/all', authenticate, authorizeRoles(['super_admin']), userController.getAllUsers);
router.put('/:id/update', authenticate, authorizeRoles(['super_admin']), userController.updateUser);
router.put('/:id/update/status', authenticate, authorizeRoles(['super_admin']), userController.updateUserStatus);
router.delete('/:id/delete', authenticate, authorizeRoles(['super_admin']), userController.deleteUser);
router.delete('/teams/:teamId/users/:userId', authenticate, authorizeRoles(['super_admin']), userController.removeUserFromTeam);

module.exports = router;