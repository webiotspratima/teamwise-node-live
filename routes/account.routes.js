const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const accountController = require('../controllers/account.controller');
const createUploader = require('../utils/upload');
const uploadAvatar = createUploader('avatars');

router.get('/getUserDetails', authenticate, authorizeRoles(['super_admin', 'user']), accountController.getUserDetails);
router.put('/updateProfile', authenticate, authorizeRoles(['super_admin', 'user']), uploadAvatar.single('avatars'), accountController.updateProfile);
router.put('/updatePassword', authenticate, authorizeRoles(['super_admin', 'user']), accountController.updatePassword);

module.exports = router;