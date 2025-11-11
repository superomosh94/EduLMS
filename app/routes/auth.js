const express = require('express');
const router = express.Router();
const passport = require('passport');

// Import controllers and middleware
const authController = require('../controllers/auth/authController');
const passwordController = require('../controllers/auth/passwordController');
const { ensureAuthenticated, forwardAuthenticated } = require('../middleware/auth');
const { validateRegistration } = require('../middleware/validation');
const { uploadProfile } = require('../middleware/upload');

// Login routes
router.get('/login', forwardAuthenticated, authController.showLogin);
router.post('/login', forwardAuthenticated, authController.login);

// Register routes
router.get('/register', forwardAuthenticated, authController.showRegister);
router.post('/register', forwardAuthenticated, validateRegistration, authController.register);

// Logout route
router.get('/logout', ensureAuthenticated, authController.logout);

// Password reset routes
router.get('/forgot-password', forwardAuthenticated, authController.showForgotPassword);
router.post('/forgot-password', forwardAuthenticated, authController.forgotPassword);
router.get('/reset-password/:token', forwardAuthenticated, authController.showResetPassword);
router.post('/reset-password/:token', forwardAuthenticated, authController.resetPassword);

// Profile and password management (authenticated routes)
router.get('/change-password', ensureAuthenticated, passwordController.showChangePassword);
router.post('/change-password', ensureAuthenticated, passwordController.changePassword);
router.get('/profile', ensureAuthenticated, passwordController.showUpdateProfile);
router.post('/profile', ensureAuthenticated, uploadProfile.single('profile_image'), passwordController.updateProfile);

module.exports = router;