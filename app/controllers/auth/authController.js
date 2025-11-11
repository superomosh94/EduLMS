const passport = require('passport');
const User = require('../../models/User');
const Student = require('../../models/Student');
const Instructor = require('../../models/Instructor');
const { ROLES } = require('../../../config/constants');
const { Generators, Validators, Helpers } = require('../../../utils');
const db = require('../../../config/database');

class AuthController {
  // Show login form
  async showLogin(req, res) {
    try {
      res.render('auth/login', {
        title: 'Login - EduLMS',
        layout: 'layouts/auth-layout',
        error_msg: req.flash('error_msg'),
        error: req.flash('error')
      });
    } catch (error) {
      console.error('❌ Login form error:', error);
      req.flash('error_msg', 'Error loading login page');
      res.redirect('/');
    }
  }

  // Handle login
  async handleLogin(req, res, next) {
    passport.authenticate('local', async (err, user, info) => {
      try {
        if (err) {
          console.error('Login error:', err);
          req.flash('error_msg', 'An error occurred during login');
          return res.redirect('/auth/login');
        }

        if (!user) {
          req.flash('error_msg', info.message || 'Invalid credentials');
          return res.redirect('/auth/login');
        }

        req.logIn(user, async (err) => {
          if (err) {
            console.error('Login session error:', err);
            req.flash('error_msg', 'An error occurred during login');
            return res.redirect('/auth/login');
          }

          // Update last login
          await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
          );

          // Log login activity
          await db.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) 
             VALUES (?, 'login', 'users', ?, ?, ?)`,
            [user.id, user.id, req.ip, req.get('User-Agent')]
          );

          // Redirect based on role
          let redirectUrl = '/dashboard';
          switch (user.role_name) {
            case ROLES.ADMIN:
              redirectUrl = '/admin/dashboard';
              break;
            case ROLES.INSTRUCTOR:
              redirectUrl = '/instructor/dashboard';
              break;
            case ROLES.STUDENT:
              redirectUrl = '/student/dashboard';
              break;
            case ROLES.FINANCE_OFFICER:
              redirectUrl = '/finance/dashboard';
              break;
          }

          req.flash('success_msg', `Welcome back, ${user.first_name}!`);
          res.redirect(redirectUrl);
        });
      } catch (error) {
        console.error('Login controller error:', error);
        req.flash('error_msg', 'An error occurred during login');
        res.redirect('/auth/login');
      }
    })(req, res, next);
  }

  // Show registration form
  async showRegister(req, res) {
    try {
      const roles = await db.query(
        'SELECT * FROM roles WHERE name != ? ORDER BY name',
        [ROLES.ADMIN]
      );

      res.render('auth/register', {
        title: 'Register - EduLMS',
        layout: 'layouts/auth-layout',
        roles,
        error_msg: req.flash('error_msg'),
        formData: req.flash('formData')[0] || {}
      });
    } catch (error) {
      console.error('Registration form error:', error);
      req.flash('error_msg', 'Error loading registration form');
      res.redirect('/auth/login');
    }
  }

  // Handle registration
  async handleRegister(req, res) {
    try {
      const {
        first_name,
        last_name,
        email,
        password,
        confirm_password,
        role_id,
        phone,
        address,
        date_of_birth,
        gender,
        student_id,
        program,
        semester,
        year,
        parent_name,
        parent_phone,
        emergency_contact,
        employee_id,
        department,
        qualification,
        specialization,
        office_location,
        office_hours
      } = req.body;

      // Store form data for re-population
      const formData = {
        first_name,
        last_name,
        email,
        phone,
        address,
        date_of_birth,
        gender,
        role_id,
        student_id,
        program,
        semester,
        year,
        parent_name,
        parent_phone,
        emergency_contact,
        employee_id,
        department,
        qualification,
        specialization,
        office_location,
        office_hours
      };

      // Validation
      if (password !== confirm_password) {
        req.flash('error_msg', 'Passwords do not match');
        req.flash('formData', formData);
        return res.redirect('/auth/register');
      }

      if (password.length < 6) {
        req.flash('error_msg', 'Password must be at least 6 characters long');
        req.flash('formData', formData);
        return res.redirect('/auth/register');
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        req.flash('error_msg', 'Email already registered');
        req.flash('formData', formData);
        return res.redirect('/auth/register');
      }

      // Get role name
      const roles = await db.query('SELECT name FROM roles WHERE id = ?', [role_id]);
      if (roles.length === 0) {
        req.flash('error_msg', 'Invalid role selected');
        req.flash('formData', formData);
        return res.redirect('/auth/register');
      }

      const roleName = roles[0].name;

      // Create user
      const userId = await User.create({
        first_name,
        last_name,
        email,
        password,
        role_id,
        phone,
        address,
        date_of_birth,
        gender,
        created_by: 1 // System admin
      });

      // Create role-specific profile
      if (roleName === ROLES.STUDENT) {
        await Student.create({
          user_id: userId,
          student_id: student_id || Generators.generateStudentId(),
          enrollment_date: new Date(),
          program,
          semester,
          year: parseInt(year),
          parent_name,
          parent_phone,
          emergency_contact
        });
      } else if (roleName === ROLES.INSTRUCTOR) {
        await Instructor.create({
          user_id: userId,
          employee_id: employee_id || Generators.generateInstructorId(),
          department,
          qualification,
          specialization,
          hire_date: new Date(),
          office_location,
          office_hours
        });
      }

      // Log registration activity
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) 
         VALUES (?, 'register', 'users', ?, ?, ?)`,
        [userId, userId, req.ip, req.get('User-Agent')]
      );

      req.flash('success_msg', 'Registration successful! Please login to continue.');
      res.redirect('/auth/login');
    } catch (error) {
      console.error('Registration error:', error);
      req.flash('error_msg', 'Registration failed. Please try again.');
      req.flash('formData', req.body);
      res.redirect('/auth/register');
    }
  }

  // Handle logout
  async handleLogout(req, res) {
    // Log logout activity
    if (req.user) {
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) 
         VALUES (?, 'logout', 'users', ?, ?, ?)`,
        [req.user.id, req.user.id, req.ip, req.get('User-Agent')]
      ).catch(err => console.error('Logout logging error:', err));
    }

    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        req.flash('error_msg', 'Error during logout');
        return res.redirect('/dashboard');
      }
      req.flash('success_msg', 'You have been logged out successfully');
      res.redirect('/auth/login');
    });
  }

  // Show user profile
  async showProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);
      let profile = null;

      if (req.user.role_name === ROLES.STUDENT) {
        profile = await Student.findByUserId(req.user.id);
      } else if (req.user.role_name === ROLES.INSTRUCTOR) {
        profile = await Instructor.findByUserId(req.user.id);
      }

      res.render('auth/profile', {
        title: 'My Profile - EduLMS',
        user,
        profile,
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      });
    } catch (error) {
      console.error('Profile error:', error);
      req.flash('error_msg', 'Error loading profile');
      res.redirect('/dashboard');
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { first_name, last_name, phone, address, date_of_birth, gender } = req.body;

      await User.update(req.user.id, {
        first_name,
        last_name,
        phone,
        address,
        date_of_birth,
        gender
      });

      // Update role-specific profile if needed
      if (req.user.role_name === ROLES.STUDENT) {
        const { program, semester, year, parent_name, parent_phone, emergency_contact } = req.body;
        await Student.update(req.user.id, {
          program,
          semester,
          year: parseInt(year),
          parent_name,
          parent_phone,
          emergency_contact
        });
      } else if (req.user.role_name === ROLES.INSTRUCTOR) {
        const { department, qualification, specialization, office_location, office_hours } = req.body;
        await Instructor.update(req.user.id, {
          department,
          qualification,
          specialization,
          office_location,
          office_hours
        });
      }

      // Log profile update
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) 
         VALUES (?, 'update_profile', 'users', ?, ?, ?)`,
        [req.user.id, req.user.id, req.ip, req.get('User-Agent')]
      );

      req.flash('success_msg', 'Profile updated successfully');
      res.redirect('/auth/profile');
    } catch (error) {
      console.error('Profile update error:', error);
      req.flash('error_msg', 'Error updating profile');
      res.redirect('/auth/profile');
    }
  }

  // Show change password form
  async showChangePassword(req, res) {
    res.render('auth/change-password', {
      title: 'Change Password - EduLMS',
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  }

  // Handle password change
  async handleChangePassword(req, res) {
    try {
      const { current_password, new_password, confirm_password } = req.body;

      if (new_password !== confirm_password) {
        req.flash('error_msg', 'New passwords do not match');
        return res.redirect('/auth/change-password');
      }

      await User.changePassword(req.user.id, current_password, new_password);

      // Log password change
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) 
         VALUES (?, 'change_password', 'users', ?, ?, ?)`,
        [req.user.id, req.user.id, req.ip, req.get('User-Agent')]
      );

      req.flash('success_msg', 'Password changed successfully');
      res.redirect('/auth/change-password');
    } catch (error) {
      console.error('Password change error:', error);
      req.flash('error_msg', error.message || 'Error changing password');
      res.redirect('/auth/change-password');
    }
  }

  // Show email verification form
  async showVerifyEmail(req, res) {
    res.render('auth/verify-email', {
      title: 'Verify Email - EduLMS',
      layout: 'layouts/auth-layout'
    });
  }

  // Handle email verification request
  async handleVerifyEmail(req, res) {
    try {
      // In a real application, you would send a verification email
      req.flash('success_msg', 'Verification email sent. Please check your inbox.');
      res.redirect('/auth/verify-email');
    } catch (error) {
      console.error('Email verification error:', error);
      req.flash('error_msg', 'Error sending verification email');
      res.redirect('/auth/verify-email');
    }
  }

  // Verify email with token
  async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      // Verify token and update user email verification status
      await db.query(
        'UPDATE users SET email_verified = 1, updated_at = NOW() WHERE verification_token = ?',
        [token]
      );

      req.flash('success_msg', 'Email verified successfully. You can now login.');
      res.redirect('/auth/login');
    } catch (error) {
      console.error('Email verification error:', error);
      req.flash('error_msg', 'Invalid or expired verification token');
      res.redirect('/auth/verify-email');
    }
  }

  // Get current user info (API)
  async getCurrentUser(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role_name: user.role_name,
          phone: user.phone,
          profile_picture: user.profile_picture
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user data'
      });
    }
  }
}

module.exports = new AuthController();