const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { loginSchema, forgotPasswordSchema } = require("../validators/auth.validators.js");
const { validate } = require("../validators/validatorMiddleware.js");

router.post('/check-email', authController.checkEmailAndSendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.post('/login', [validate(loginSchema)], authController.login);
router.post('/forgot-password',[validate(forgotPasswordSchema)], authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;