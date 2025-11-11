const bcrypt = require('bcryptjs');
const db = require('../../../config/database');
const User = require('../../models/User');

const passwordController = {
  // Show change password form
  showChangePassword: (req, res) => {
    res.render('auth/change-password', {
      title: 'Change Password - EduLMS',
      layout: getLayout(req.user.role_name)
    });
  },

  // Handle password change
  changePassword: async (req, res) => {
    try {
      const { current_password, new_password, confirm_password } = req.body;
      const userId = req.user.id;

      // Validation
      const errors = [];

      if (!current_password || !new_password || !confirm_password) {
        errors.push({ msg: 'Please fill in all fields' });
      }

      if (new_password !== confirm_password) {
        errors.push({ msg: 'New passwords do not match' });
      }

      if (new_password.length < 6) {
        errors.push({ msg: 'New password should be at least 6 characters' });
      }

      if (errors.length > 0) {
        return res.render('auth/change-password', {
          title: 'Change Password - EduLMS',
          layout: getLayout(req.user.role_name),
          errors
        });
      }

      // Verify current password
      const user = await User.findById(userId);
      const isCurrentPasswordValid = await User.verifyPassword(current_password, user.password);

      if (!isCurrentPasswordValid) {
        errors.push({ msg: 'Current password is incorrect' });
        return res.render('auth/change-password', {
          title: 'Change Password - EduLMS',
          layout: getLayout(req.user.role_name),
          errors
        });
      }

      // Change password
      await User.changePassword(userId, new_password);

      // Log password change
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address) 
         VALUES (?, 'password_change', 'users', ?, ?)`,
        [userId, userId, req.ip]
      );

      req.flash('success_msg', 'Password changed successfully');
      res.redirect(getDashboardPath(req.user.role_name));

    } catch (error) {
      console.error('Change password error:', error);
      req.flash('error_msg', 'Error changing password. Please try again.');
      res.redirect('/auth/change-password');
    }
  },

  // Show update profile form
  showUpdateProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user.id);

      res.render('auth/update-profile', {
        title: 'Update Profile - EduLMS',
        layout: getLayout(req.user.role_name),
        user
      });
    } catch (error) {
      console.error('Show profile error:', error);
      req.flash('error_msg', 'Error loading profile');
      res.redirect(getDashboardPath(req.user.role_name));
    }
  },

  // Handle profile update
  updateProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      const { name, phone, address, date_of_birth, gender } = req.body;

      const updateData = {
        name,
        phone: phone || null,
        address: address || null,
        date_of_birth: date_of_birth || null,
        gender: gender || null
      };

      // Handle file upload if provided
      if (req.file) {
        updateData.profile_image = `/uploads/profiles/${req.file.filename}`;
      }

      await User.update(userId, updateData);

      // Log profile update
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address) 
         VALUES (?, 'profile_update', 'users', ?, ?)`,
        [userId, userId, req.ip]
      );

      req.flash('success_msg', 'Profile updated successfully');
      res.redirect('/auth/profile');

    } catch (error) {
      console.error('Update profile error:', error);
      req.flash('error_msg', 'Error updating profile. Please try again.');
      res.redirect('/auth/profile');
    }
  }
};

// Helper functions
function getLayout(role) {
  const layouts = {
    'admin': 'layouts/admin-layout',
    'instructor': 'layouts/instructor-layout', 
    'student': 'layouts/student-layout',
    'finance_officer': 'layouts/finance-layout'
  };
  return layouts[role] || 'layouts/layout';
}

function getDashboardPath(role) {
  const paths = {
    'admin': '/admin/dashboard',
    'instructor': '/instructor/dashboard',
    'student': '/student/dashboard',
    'finance_officer': '/finance/dashboard'
  };
  return paths[role] || '/dashboard';
}

module.exports = passwordController;