const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const settingController = require('../controllers/setting.controller');
const createUploader = require('../utils/upload');
const uploadLogo = createUploader('logos');

router.get('/', authenticate, authorizeRoles(['super_admin', 'user']), settingController.getSettings);
router.put('/update', authenticate, authorizeRoles(['super_admin']), uploadLogo.single('logo'), settingController.updateSettings);

module.exports = router;