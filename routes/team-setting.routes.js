const express = require('express');
const router = express.Router();
const { authenticate, authorizeTeamRole } = require('../middlewares/auth');
const teamSettingController = require('../controllers/team-setting.controller');

router.get('/', authenticate, authorizeTeamRole(['admin']), teamSettingController.getTeamSettings);
router.put('/update', authenticate, authorizeTeamRole(['admin']), teamSettingController.updateTeamSetting);

module.exports = router;