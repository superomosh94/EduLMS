const crypto = require('crypto');
const User = require('../../models/User');
const { Generators, Validators } = require('../../../utils');
const db = require('../../../config/database');
const emailService = require('../../services/emailService');

class PasswordController {
  // Show forgot password form
  async showForgotPassword(req, res) {
    res.render('auth/forgot-password', {
      title: 'Forgot Password - EduLMS',
      layout: 'layouts/auth-layout',
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  }

  // Handle forgot password request
  async handleForgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal whether email exists for security
        req.flash('success_msg', 'If an account with that email exists, a password reset link has been sent.');
        return res.redirect('/auth/forgot-password');
      }

      // Generate reset token
      const resetToken = Generators.generateResetToken();
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour

      // Save reset token to database
      await db.query(
        'UPDATE users SET reset_token = ?, reset_expires = ?, updated_at = NOW() WHERE id = ?',
        [resetToken, resetExpires, user.id]
      );

      // Send reset email
      const resetUrl = `${process.env.APP_URL}/auth/reset-password?token=${resetToken}`;
      
      await emailService.sendPasswordResetEmail(user, resetToken);

      // Log password reset request
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) 
         VALUES (?, 'password_reset_request', 'users', ?, ?, ?)`,
        [user.id, user.id, req.ip, req.get('User-Agent')]
      );

      req.flash('success_msg', 'Password reset instructions have been sent to your email.');
      res.redirect('/auth/forgot-password');
    } catch (error) {
      console.error('Forgot password error:', error);
      req.flash('error_msg', 'Error processing password reset request');
      res.redirect('/auth/forgot-password');
    }
  }

  // Show reset password form
  async showResetPassword(req, res) {
    const { token } = req.query;

    if (!token) {
      req.flash('error_msg', 'Invalid reset token');
      return res.redirect('/auth/forgot-password');
    }

    // Verify token validity
    const users = await db.query(
      'SELECT id, email FROM users WHERE reset_token = ? AND reset_expires > NOW()',
      [token]
    );

    if (users.length === 0) {
      req.flash('error_msg', 'Invalid or expired reset token');
      return res.redirect('/auth/forgot-password');
    }

    res.render('auth/reset-password', {
      title: 'Reset Password - EduLMS',
      layout: 'layouts/auth-layout',
      token,
      error_msg: req.flash('error_msg')
    });
  }

  // Handle password reset
  async handleResetPassword(req, res) {
    try {
      const { token, password, confirm_password } = req.body;

      if (password !== confirm_password) {
        req.flash('error_msg', 'Passwords do not match');
        return res.redirect(`/auth/reset-password?token=${token}`);
      }

      // Verify token and get user
      const users = await db.query(
        'SELECT id, email FROM users WHERE reset_token = ? AND reset_expires > NOW()',
        [token]
      );

      if (users.length === 0) {
        req.flash('error_msg', 'Invalid or expired reset token');
        return res.redirect('/auth/forgot-password');
      }

      const user = users[0];

      // Update password and clear reset token
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await require('bcryptjs').hash(password, saltRounds);

      await db.query(
        'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL, updated_at = NOW() WHERE id = ?',
        [hashedPassword, user.id]
      );

      // Send confirmation email
      await emailService.sendEmail(
        user.email,
        'Password Reset Successful',
        'password-reset-success',
        {
          siteName: process.env.SITE_NAME || 'EduLMS',
          userName: user.first_name // You might want to fetch full user details
        }
      );

      // Log password reset
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) 
         VALUES (?, 'password_reset', 'users', ?, ?, ?)`,
        [user.id, user.id, req.ip, req.get('User-Agent')]
      );

      req.flash('success_msg', 'Password reset successfully. You can now login with your new password.');
      res.redirect('/auth/login');
    } catch (error) {
      console.error('Password reset error:', error);
      req.flash('error_msg', 'Error resetting password');
      res.redirect(`/auth/reset-password?token=${req.body.token}`);
    }
  }

  // Validate reset token (API)
  async validateResetToken(req, res) {
    try {
      const { token } = req.params;

      const users = await db.query(
        'SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()',
        [token]
      );

      if (users.length === 0) {
        return res.json({
          valid: false,
          message: 'Invalid or expired token'
        });
      }

      res.json({
        valid: true,
        message: 'Token is valid'
      });
    } catch (error) {
      console.error('Validate reset token error:', error);
      res.status(500).json({
        valid: false,
        message: 'Error validating token'
      });
    }
  }
}

module.exports = new PasswordController();