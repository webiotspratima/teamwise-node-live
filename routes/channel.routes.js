const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channel.controller');
const { authenticate, authorizeTeamRole, authorizeRoles } = require("../middlewares/auth");

router.get('/:id', authenticate, authorizeTeamRole(['admin', 'member']), channelController.getChannelInfo);
router.post('/create', authenticate, authorizeTeamRole(['admin', 'member']), channelController.createChannel);
router.get('/team', authenticate, authorizeTeamRole(['admin', 'member']), channelController.getChannelsByTeam);
router.put('/:id', authenticate, authorizeTeamRole(['admin', 'member']), channelController.updateChannel);
router.delete('/:id', authenticate, authorizeTeamRole(['admin', 'member']), channelController.deleteChannel);

router.post('/members/add', authenticate, authorizeTeamRole(['admin', 'member']), channelController.addMembersToChannel);
router.post('/members/remove', authenticate, authorizeTeamRole(['admin', 'member']), channelController.removeMemberFromChannel);
router.post('/members/update/role', authenticate, authorizeTeamRole(['admin', 'member']), channelController.changeMemberRole);

// Admin
router.get('/all', authenticate, authorizeRoles(['super_admin']), channelController.getAllChannels);

module.exports = router;