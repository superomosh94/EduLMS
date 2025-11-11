const express = require('express');
const router = express.Router();
const passport = require('passport');
const { isNotAuthenticated, isAuthenticated } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const authController = require('../controllers/auth/authController');
const passwordController = require('../controllers/auth/passwordController');
const { validateUserRegistration, validateUserLogin, validateForgotPassword, validateResetPassword } = require('../validators/userValidators');

// Login routes
router.get('/login', isNotAuthenticated, authController.showLogin);
router.post('/login', isNotAuthenticated, validateUserLogin, authController.handleLogin);

// Registration routes
router.get('/register', isNotAuthenticated, authController.showRegister);
router.post('/register', isNotAuthenticated, validateUserRegistration, authController.handleRegister);

// Logout route
router.post('/logout', isAuthenticated, authController.handleLogout);

// Password reset routes
router.get('/forgot-password', isNotAuthenticated, passwordController.showForgotPassword);
router.post('/forgot-password', isNotAuthenticated, validateForgotPassword, passwordController.handleForgotPassword);
router.get('/reset-password', isNotAuthenticated, passwordController.showResetPassword);
router.post('/reset-password', isNotAuthenticated, validateResetPassword, passwordController.handleResetPassword);

// Email verification routes
router.get('/verify-email', isNotAuthenticated, authController.showVerifyEmail);
router.post('/verify-email', isNotAuthenticated, authController.handleVerifyEmail);
router.get('/verify/:token', isNotAuthenticated, authController.verifyEmail);

// Profile routes (requires authentication)
router.get('/profile', isAuthenticated, authController.showProfile);
router.post('/profile', isAuthenticated, authController.updateProfile);
router.get('/change-password', isAuthenticated, authController.showChangePassword);
router.post('/change-password', isAuthenticated, authController.handleChangePassword);

// Session check API
router.get('/session', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        email: req.user.email,
        role_name: req.user.role_name
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;