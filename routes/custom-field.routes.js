const express = require('express');
const router = express.Router();
const { authenticate, authorizeTeamRole } = require('../middlewares/auth');
const customFieldController = require('../controllers/custom-field.controller');

router.get('/all', authenticate, authorizeTeamRole(['admin', 'member']), customFieldController.getCustomFields);
router.post('/create', authenticate, authorizeTeamRole(['admin']), customFieldController.createCustomField);
router.put('/update/:id', authenticate, authorizeTeamRole(['admin']), customFieldController.updateCustomField);
router.delete('/delete/:id', authenticate, authorizeTeamRole(['admin']), customFieldController.deleteCustomField);

router.put('/update/value', authenticate, authorizeTeamRole(['admin','member']), customFieldController.updateUserValue);

module.exports = router;
