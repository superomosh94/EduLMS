const User = require('../../models/User');

// Simple token generation
const generateSimpleToken = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const passwordController = {
  // Show forgot password page
  showForgotPassword: (req, res) => {
    res.render('auth/forgot-password', {
      title: 'Forgot Password - EduLMS',
      error_msg: req.flash('error_msg'),
      success_msg: req.flash('success_msg')
    });
  },

  // Show reset password page
  showResetPassword: (req, res) => {
    const { token } = req.params;
    res.render('auth/reset-password', {
      title: 'Reset Password - EduLMS',
      token: token,
      error_msg: req.flash('error_msg'),
      success_msg: req.flash('success_msg')
    });
  },

  // Handle forgot password request
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      // Check if user exists
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not
        req.flash('success_msg', 'If an account with that email exists, a password reset link has been sent.');
        return res.redirect('/auth/forgot-password');
      }

      // Generate simple reset token (in production, use proper JWT)
      const resetToken = generateSimpleToken();
      
      // Simulate sending email
      console.log('📧 Password reset email would be sent to:', email);
      console.log('🔗 Reset token:', resetToken);

      req.flash('success_msg', 'Password reset instructions have been sent to your email.');
      res.redirect('/auth/forgot-password');

    } catch (error) {
      console.error('Forgot password error:', error);
      req.flash('error_msg', 'Failed to process password reset request. Please try again.');
      res.redirect('/auth/forgot-password');
    }
  },

  // Handle password reset
  resetPassword: async (req, res) => {
    try {
      const { token } = req.params;
      const { password, confirm_password } = req.body;

      // Basic validation
      if (password !== confirm_password) {
        req.flash('error_msg', 'Passwords do not match.');
        return res.redirect(`/auth/reset-password/${token}`);
      }

      if (password.length < 8) {
        req.flash('error_msg', 'Password must be at least 8 characters long.');
        return res.redirect(`/auth/reset-password/${token}`);
      }

      // In a real app, you would verify the token and get the user ID
      // For now, we'll simulate successful reset
      console.log('Password reset simulated for token:', token);

      req.flash('success_msg', 'Password reset successfully! You can now login with your new password.');
      res.redirect('/auth/login');

    } catch (error) {
      console.error('Reset password error:', error);
      req.flash('error_msg', 'Failed to reset password. Please try again.');
      res.redirect(`/auth/reset-password/${token}`);
    }
  }
};

module.exports = passwordController;