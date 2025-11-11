const passport = require('passport');
const bcrypt = require('bcryptjs');
const db = require('../../../config/database');
const User = require('../../models/User');
const { ROLES } = require('../../../config/constants');

const authController = {
  // Show login form
  showLogin: (req, res) => {
    res.render('auth/login', {
      title: 'Login - EduLMS',
      layout: 'layouts/layout'
    });
  },

  // Show register form
  showRegister: (req, res) => {
    res.render('auth/register', {
      title: 'Register - EduLMS',
      layout: 'layouts/layout',
      roles: Object.values(ROLES).filter(role => role !== ROLES.ADMIN) // Don't allow admin self-registration
    });
  },

  // Handle user registration
  register: async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        password2,
        role,
        phone,
        address,
        date_of_birth,
        gender
      } = req.body;

      // Validation
      const errors = [];

      if (!name || !email || !password || !password2 || !role) {
        errors.push({ msg: 'Please fill in all required fields' });
      }

      if (password !== password2) {
        errors.push({ msg: 'Passwords do not match' });
      }

      if (password.length < 6) {
        errors.push({ msg: 'Password should be at least 6 characters' });
      }

      if (!Object.values(ROLES).includes(role)) {
        errors.push({ msg: 'Invalid role selected' });
      }

      if (errors.length > 0) {
        return res.render('auth/register', {
          title: 'Register - EduLMS',
          layout: 'layouts/layout',
          errors,
          formData: { name, email, phone, address, date_of_birth, gender, role },
          roles: Object.values(ROLES).filter(r => r !== ROLES.ADMIN)
        });
      }

      // Check if user exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        errors.push({ msg: 'Email is already registered' });
        return res.render('auth/register', {
          title: 'Register - EduLMS',
          layout: 'layouts/layout',
          errors,
          formData: { name, email, phone, address, date_of_birth, gender, role },
          roles: Object.values(ROLES).filter(r => r !== ROLES.ADMIN)
        });
      }

      // Get role ID
      const roleId = await User.getRoleId(role);
      if (!roleId) {
        errors.push({ msg: 'Invalid role selected' });
        return res.render('auth/register', {
          title: 'Register - EduLMS',
          layout: 'layouts/layout',
          errors,
          formData: { name, email, phone, address, date_of_birth, gender, role },
          roles: Object.values(ROLES).filter(r => r !== ROLES.ADMIN)
        });
      }

      // Generate unique IDs based on role
      let student_id = null;
      let teacher_id = null;
      let employee_id = null;

      if (role === ROLES.STUDENT) {
        student_id = await User.generateUniqueId(ROLES.STUDENT);
      } else if (role === ROLES.INSTRUCTOR) {
        teacher_id = await User.generateUniqueId(ROLES.INSTRUCTOR);
      } else if (role === ROLES.FINANCE_OFFICER) {
        employee_id = await User.generateUniqueId(ROLES.FINANCE_OFFICER);
      }

      // Create user data object
      const userData = {
        name,
        email,
        password,
        role_id: roleId,
        phone: phone || null,
        address: address || null,
        date_of_birth: date_of_birth || null,
        gender: gender || null,
        student_id,
        teacher_id,
        employee_id
      };

      // Create user
      const userId = await User.create(userData);

      // Log registration
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) 
         VALUES (?, 'user_registration', 'users', ?, ?, ?)`,
        [userId, userId, req.ip, req.get('User-Agent')]
      );

      req.flash('success_msg', 'You are now registered and can log in');
      res.redirect('/auth/login');

    } catch (error) {
      console.error('Registration error:', error);
      req.flash('error_msg', 'Registration failed. Please try again.');
      res.redirect('/auth/register');
    }
  },

  // Handle user login
  login: (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }

      if (!user) {
        req.flash('error_msg', info.message || 'Login failed');
        return res.redirect('/auth/login');
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error('Login session error:', err);
          return next(err);
        }

        // Redirect based on role
        const redirectPaths = {
          [ROLES.ADMIN]: '/admin/dashboard',
          [ROLES.INSTRUCTOR]: '/instructor/dashboard',
          [ROLES.STUDENT]: '/student/dashboard',
          [ROLES.FINANCE_OFFICER]: '/finance/dashboard'
        };

        const redirectPath = redirectPaths[user.role_name] || '/dashboard';
        
        req.flash('success_msg', `Welcome back, ${user.name}!`);
        res.redirect(redirectPath);
      });
    })(req, res, next);
  },

  // Handle user logout
  logout: (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        req.flash('error_msg', 'Error during logout');
        return res.redirect('/dashboard');
      }

      req.flash('success_msg', 'You are logged out');
      res.redirect('/auth/login');
    });
  },

  // Show forgot password form
  showForgotPassword: (req, res) => {
    res.render('auth/forgot-password', {
      title: 'Forgot Password - EduLMS',
      layout: 'layouts/layout'
    });
  },

  // Handle forgot password request
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        req.flash('error_msg', 'Please enter your email address');
        return res.redirect('/auth/forgot-password');
      }

      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal whether email exists for security
        req.flash('success_msg', 'If an account with that email exists, a password reset link has been sent.');
        return res.redirect('/auth/login');
      }

      // In a real application, you would:
      // 1. Generate a reset token
      // 2. Save it to the database with expiry
      // 3. Send email with reset link

      req.flash('success_msg', 'If an account with that email exists, a password reset link has been sent.');
      res.redirect('/auth/login');

    } catch (error) {
      console.error('Forgot password error:', error);
      req.flash('error_msg', 'Error processing your request. Please try again.');
      res.redirect('/auth/forgot-password');
    }
  },

  // Show reset password form
  showResetPassword: (req, res) => {
    const { token } = req.params;
    
    // In a real application, you would verify the token here
    
    res.render('auth/reset-password', {
      title: 'Reset Password - EduLMS',
      layout: 'layouts/layout',
      token
    });
  },

  // Handle password reset
  resetPassword: async (req, res) => {
    try {
      const { token } = req.params;
      const { password, password2 } = req.body;

      // Validation
      if (!password || !password2) {
        req.flash('error_msg', 'Please fill in all fields');
        return res.redirect(`/auth/reset-password/${token}`);
      }

      if (password !== password2) {
        req.flash('error_msg', 'Passwords do not match');
        return res.redirect(`/auth/reset-password/${token}`);
      }

      if (password.length < 6) {
        req.flash('error_msg', 'Password should be at least 6 characters');
        return res.redirect(`/auth/reset-password/${token}`);
      }

      // In a real application, you would:
      // 1. Verify the token and get user ID
      // 2. Update the password
      // 3. Invalidate the token

      req.flash('success_msg', 'Password has been reset successfully. You can now login with your new password.');
      res.redirect('/auth/login');

    } catch (error) {
      console.error('Reset password error:', error);
      req.flash('error_msg', 'Error resetting password. Please try again.');
      res.redirect(`/auth/reset-password/${token}`);
    }
  }
};

module.exports = authController;