const express = require('express');
const router = express.Router();
const { authenticate, authorizeTeamRole } = require('../middlewares/auth');
const reminderController = require('../controllers/reminder.controller');

router.post('/set', authenticate, authorizeTeamRole(['admin', 'member']), reminderController.setReminder);
router.post('/cancel', authenticate, authorizeTeamRole(['admin', 'member']), reminderController.cancelReminder);

module.exports = router;