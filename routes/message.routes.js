const express = require('express');
const router = express.Router();
const { authenticate, authorizeTeamRole } = require('../middlewares/auth');
const messageController = require('../controllers/message.controller');

router.get('/', authenticate, authorizeTeamRole(['admin', 'member']), messageController.getMessages);
router.post('/start', authenticate, authorizeTeamRole(['admin', 'member']), messageController.createMessage);
router.post('/update', authenticate, authorizeTeamRole(['admin', 'member']), messageController.updateMessage);
router.delete('/delete/:id', authenticate, authorizeTeamRole(['admin', 'member']), messageController.deleteMessage);

router.get('/conversations', authenticate, authorizeTeamRole(['admin', 'member']), messageController.getConversations);
router.post('/conversation/pin', authenticate, authorizeTeamRole(['admin', 'member']), messageController.pinOrUnpinConversation);

router.post('/reaction', authenticate, authorizeTeamRole(['admin', 'member']), messageController.addReaction);
router.delete('/reaction', authenticate, authorizeTeamRole(['admin', 'member']), messageController.removeReaction);

router.post('/mute', authenticate, authorizeTeamRole(['admin', 'member']), messageController.muteChat);
router.post('/unmute', authenticate, authorizeTeamRole(['admin', 'member']), messageController.unmuteChat);

router.post('/pin', authenticate, authorizeTeamRole(['admin', 'member']), messageController.pinMessage);
router.post('/unpin', authenticate, authorizeTeamRole(['admin', 'member']), messageController.unpinMessage);

router.post('/favorite', authenticate, authorizeTeamRole(['admin', 'member']), messageController.favoriteMessage);
router.post('/unfavorite', authenticate, authorizeTeamRole(['admin', 'member']), messageController.unfavoriteMessage);

module.exports = router;