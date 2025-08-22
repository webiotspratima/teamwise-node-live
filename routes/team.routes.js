const express = require('express');
const router = express.Router();
const { authenticate, authorizeTeamRole, authorizeRoles } = require('../middlewares/auth');
const teamController = require('../controllers/team.controller');
const createUploader = require('../utils/upload');
const uploadAvatar = createUploader('team_avatars');

// On Boarding (Team admin or Member)
router.post('/create', teamController.createTeam);
router.get('/find', teamController.findTeam);
router.post('/join', teamController.joinTeamPreUser);
router.put('/setup/profile', teamController.setupUserProfile);
router.get('/', authenticate, authorizeRoles(['user']), teamController.getTeams);

// Team Admin
router.post('/add', authenticate, authorizeRoles(['user']), teamController.addNewTeam);
router.post('/invite/member', authenticate, authorizeRoles(['user']), teamController.inviteTeamMember);
router.put('/update/status', authenticate, authorizeTeamRole(['admin']), teamController.updateTeamMemberStatus);
router.put('/update/profile', authenticate, authorizeTeamRole(['admin']), uploadAvatar.single('team_avatars'), teamController.updateTeam);
router.get('/members', authenticate, authorizeTeamRole(['admin', 'member']), teamController.getTeamMembers);
router.delete('/users/:userId', authenticate, authorizeTeamRole(['admin']), teamController.removeUserFromTeam);

// Admin
router.get('/all', authenticate, authorizeRoles(['super_admin']), teamController.getAllTeams);

module.exports = router;