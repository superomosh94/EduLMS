const db = require('../../../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            req.flash('error', 'Please provide your email address');
            return res.redirect('/auth/forgot-password');
        }

        // Check if user exists
        const [users] = await db.promise().execute(
            'SELECT id, email FROM users WHERE email = ?', 
            [email]
        );
        
        if (users.length === 0) {
            // Don't reveal whether email exists or not
            req.flash('success_msg', 'If an account with that email exists, a password reset link has been sent.');
            return res.redirect('/auth/forgot-password');
        }

        const user = users[0];
        
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

        // Store token in database
        await db.promise().execute(
            'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
            [resetToken, new Date(resetTokenExpiry), user.id]
        );

        // In a real application, you would send an email here
        // For now, we'll just show the reset link
        const resetLink = `${req.protocol}://${req.get('host')}/auth/reset-password?token=${resetToken}`;
        
        console.log('Password reset link:', resetLink); // For development
        
        req.flash('success_msg', 'Password reset link has been generated. Check your email (and console for development).');
        res.redirect('/auth/forgot-password');

    } catch (error) {
        console.error('Forgot password error:', error);
        req.flash('error', 'Error processing your request. Please try again.');
        res.redirect('/auth/forgot-password');
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, password, password2 } = req.body;

        if (!token) {
            req.flash('error', 'Invalid reset token');
            return res.redirect('/auth/forgot-password');
        }

        if (password !== password2) {
            req.flash('error', 'Passwords do not match');
            return res.redirect(`/auth/reset-password?token=${token}`);
        }

        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters long');
            return res.redirect(`/auth/reset-password?token=${token}`);
        }

        // Find user with valid reset token
        const [users] = await db.promise().execute(
            'SELECT id, reset_token_expiry FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
            [token]
        );

        if (users.length === 0) {
            req.flash('error', 'Invalid or expired reset token');
            return res.redirect('/auth/forgot-password');
        }

        const user = users[0];
        const hashedPassword = await bcrypt.hash(password, 12);

        // Update password and clear reset token
        await db.promise().execute(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        req.flash('success_msg', 'Password reset successfully! You can now login with your new password.');
        res.redirect('/auth/login');

    } catch (error) {
        console.error('Reset password error:', error);
        req.flash('error', 'Error resetting password. Please try again.');
        res.redirect('/auth/forgot-password');
    }
};