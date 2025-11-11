const db = require('../../../config/database');
const User = require('../../models/User');
const Admin = require('../../models/Admin');
const Course = require('../../models/Course');
const { ROLES } = require('../../../config/constants');

const adminController = {
  // Admin dashboard
  dashboard: async (req, res) => {
    try {
      const statistics = await Admin.getSystemStatistics();
      
      res.render('admin/dashboard', {
        title: 'Admin Dashboard - EduLMS',
        layout: 'layouts/admin-layout',
        statistics,
        currentPage: 'dashboard'
      });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      req.flash('error_msg', 'Error loading dashboard');
      res.render('admin/dashboard', {
        title: 'Admin Dashboard - EduLMS',
        layout: 'layouts/admin-layout',
        statistics: {},
        currentPage: 'dashboard'
      });
    }
  },

  // User management - list all users
  listUsers: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const role = req.query.role || '';
      const is_active = req.query.is_active !== undefined ? parseInt(req.query.is_active) : undefined;

      const filters = {};
      if (search) filters.search = search;
      if (role) filters.role = role;
      if (is_active !== undefined) filters.is_active = is_active;

      const usersData = await User.findAll(filters, page, limit);
      const userStats = await Admin.getUserManagementStats();

      res.render('admin/users/list', {
        title: 'User Management - EduLMS',
        layout: 'layouts/admin-layout',
        users: usersData.users,
        pagination: {
          current: page,
          pages: usersData.totalPages,
          total: usersData.total
        },
        filters,
        roles: Object.values(ROLES),
        userStats,
        currentPage: 'users'
      });
    } catch (error) {
      console.error('List users error:', error);
      req.flash('error_msg', 'Error loading users');
      res.render('admin/users/list', {
        title: 'User Management - EduLMS',
        layout: 'layouts/admin-layout',
        users: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: {},
        roles: Object.values(ROLES),
        userStats: {},
        currentPage: 'users'
      });
    }
  },

  // Show create user form
  showCreateUser: (req, res) => {
    res.render('admin/users/create', {
      title: 'Create User - EduLMS',
      layout: 'layouts/admin-layout',
      roles: Object.values(ROLES),
      currentPage: 'users'
    });
  },

  // Create new user
  createUser: async (req, res) => {
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
        gender,
        qualification,
        specialization,
        parent_phone,
        admission_date,
        hire_date
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
        return res.render('admin/users/create', {
          title: 'Create User - EduLMS',
          layout: 'layouts/admin-layout',
          errors,
          formData: req.body,
          roles: Object.values(ROLES),
          currentPage: 'users'
        });
      }

      // Check if user exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        errors.push({ msg: 'Email is already registered' });
        return res.render('admin/users/create', {
          title: 'Create User - EduLMS',
          layout: 'layouts/admin-layout',
          errors,
          formData: req.body,
          roles: Object.values(ROLES),
          currentPage: 'users'
        });
      }

      // Get role ID
      const roleId = await User.getRoleId(role);
      if (!roleId) {
        errors.push({ msg: 'Invalid role selected' });
        return res.render('admin/users/create', {
          title: 'Create User - EduLMS',
          layout: 'layouts/admin-layout',
          errors,
          formData: req.body,
          roles: Object.values(ROLES),
          currentPage: 'users'
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
        employee_id,
        qualification: qualification || null,
        specialization: specialization || null,
        parent_phone: parent_phone || null,
        admission_date: admission_date || null,
        hire_date: hire_date || null
      };

      // Create user
      const userId = await User.create(userData);

      // Log user creation
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, details) 
         VALUES (?, 'user_create', 'users', ?, ?)`,
        [req.user.id, userId, JSON.stringify({ created_by: req.user.id })]
      );

      req.flash('success_msg', 'User created successfully');
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Create user error:', error);
      req.flash('error_msg', 'Error creating user. Please try again.');
      res.redirect('/admin/users/create');
    }
  },

  // Show edit user form
  showEditUser: async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        req.flash('error_msg', 'User not found');
        return res.redirect('/admin/users');
      }

      res.render('admin/users/edit', {
        title: 'Edit User - EduLMS',
        layout: 'layouts/admin-layout',
        user,
        roles: Object.values(ROLES),
        currentPage: 'users'
      });
    } catch (error) {
      console.error('Show edit user error:', error);
      req.flash('error_msg', 'Error loading user');
      res.redirect('/admin/users');
    }
  },

  // Update user
  updateUser: async (req, res) => {
    try {
      const userId = req.params.id;
      const {
        name,
        phone,
        address,
        date_of_birth,
        gender,
        qualification,
        specialization,
        parent_phone,
        is_active
      } = req.body;

      const updateData = {
        name,
        phone: phone || null,
        address: address || null,
        date_of_birth: date_of_birth || null,
        gender: gender || null,
        qualification: qualification || null,
        specialization: specialization || null,
        parent_phone: parent_phone || null,
        is_active: is_active === '1'
      };

      await User.update(userId, updateData);

      // Log user update
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, details) 
         VALUES (?, 'user_update', 'users', ?, ?)`,
        [req.user.id, userId, JSON.stringify(updateData)]
      );

      req.flash('success_msg', 'User updated successfully');
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Update user error:', error);
      req.flash('error_msg', 'Error updating user. Please try again.');
      res.redirect(`/admin/users/edit/${req.params.id}`);
    }
  },

  // Delete user (soft delete)
  deleteUser: async (req, res) => {
    try {
      const userId = req.params.id;

      // Prevent self-deletion
      if (parseInt(userId) === req.user.id) {
        req.flash('error_msg', 'You cannot delete your own account');
        return res.redirect('/admin/users');
      }

      await User.delete(userId);

      // Log user deletion
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id) 
         VALUES (?, 'user_delete', 'users', ?)`,
        [req.user.id, userId]
      );

      req.flash('success_msg', 'User deleted successfully');
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Delete user error:', error);
      req.flash('error_msg', 'Error deleting user. Please try again.');
      res.redirect('/admin/users');
    }
  },

  // View user details
  viewUser: async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        req.flash('error_msg', 'User not found');
        return res.redirect('/admin/users');
      }

      // Get additional user statistics based on role
      let userStats = {};
      if (user.role_name === ROLES.STUDENT) {
        const Student = require('../../models/Student');
        userStats = await Student.getAcademicSummary(userId);
      } else if (user.role_name === ROLES.INSTRUCTOR) {
        const Instructor = require('../../models/Instructor');
        userStats = await Instructor.getProfile(userId);
      }

      res.render('admin/users/view', {
        title: `User Details - ${user.name}`,
        layout: 'layouts/admin-layout',
        user,
        userStats,
        currentPage: 'users'
      });
    } catch (error) {
      console.error('View user error:', error);
      req.flash('error_msg', 'Error loading user details');
      res.redirect('/admin/users');
    }
  },

  // Bulk user operations
  bulkUserOperation: async (req, res) => {
    try {
      const { operation, user_ids } = req.body;
      const userIds = Array.isArray(user_ids) ? user_ids : [user_ids];

      if (!userIds.length) {
        req.flash('error_msg', 'No users selected');
        return res.redirect('/admin/users');
      }

      // Prevent self-modification in bulk operations
      if (userIds.includes(req.user.id.toString())) {
        req.flash('error_msg', 'You cannot perform this operation on your own account');
        return res.redirect('/admin/users');
      }

      let data = {};
      if (operation === 'change_role') {
        data.role_id = await User.getRoleId(req.body.role);
        if (!data.role_id) {
          req.flash('error_msg', 'Invalid role selected');
          return res.redirect('/admin/users');
        }
      }

      const result = await Admin.bulkUserOperation(operation, userIds, data);

      req.flash('success_msg', `${result.affectedRows} users updated successfully`);
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Bulk user operation error:', error);
      req.flash('error_msg', 'Error performing bulk operation. Please try again.');
      res.redirect('/admin/users');
    }
  },

  // Financial overview
  financialOverview: async (req, res) => {
    try {
      const timeframe = req.query.timeframe || 'month';
      const financialData = await Admin.getFinancialOverview(timeframe);

      res.render('admin/finance/overview', {
        title: 'Financial Overview - EduLMS',
        layout: 'layouts/admin-layout',
        financialData,
        timeframe,
        currentPage: 'finance'
      });
    } catch (error) {
      console.error('Financial overview error:', error);
      req.flash('error_msg', 'Error loading financial overview');
      res.render('admin/finance/overview', {
        title: 'Financial Overview - EduLMS',
        layout: 'layouts/admin-layout',
        financialData: {},
        timeframe: 'month',
        currentPage: 'finance'
      });
    }
  },

  // Academic overview
  academicOverview: async (req, res) => {
    try {
      const academicData = await Admin.getAcademicOverview();

      res.render('admin/academic/overview', {
        title: 'Academic Overview - EduLMS',
        layout: 'layouts/admin-layout',
        academicData,
        currentPage: 'academic'
      });
    } catch (error) {
      console.error('Academic overview error:', error);
      req.flash('error_msg', 'Error loading academic overview');
      res.render('admin/academic/overview', {
        title: 'Academic Overview - EduLMS',
        layout: 'layouts/admin-layout',
        academicData: {},
        currentPage: 'academic'
      });
    }
  },

  // System settings
  systemSettings: async (req, res) => {
    try {
      const settings = await db.query('SELECT * FROM system_settings ORDER BY setting_key');

      res.render('admin/system/settings', {
        title: 'System Settings - EduLMS',
        layout: 'layouts/admin-layout',
        settings,
        currentPage: 'system'
      });
    } catch (error) {
      console.error('System settings error:', error);
      req.flash('error_msg', 'Error loading system settings');
      res.render('admin/system/settings', {
        title: 'System Settings - EduLMS',
        layout: 'layouts/admin-layout',
        settings: [],
        currentPage: 'system'
      });
    }
  },

  // Update system settings
  updateSystemSettings: async (req, res) => {
    try {
      const settings = req.body.settings;

      for (const [key, value] of Object.entries(settings)) {
        await db.query(
          'UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
          [value, key]
        );
      }

      // Log settings update
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, details) 
         VALUES (?, 'system_settings_update', 'system_settings', ?)`,
        [req.user.id, JSON.stringify({ updated_keys: Object.keys(settings) })]
      );

      req.flash('success_msg', 'System settings updated successfully');
      res.redirect('/admin/system/settings');

    } catch (error) {
      console.error('Update system settings error:', error);
      req.flash('error_msg', 'Error updating system settings');
      res.redirect('/admin/system/settings');
    }
  },

  // Audit logs
  auditLogs: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const action = req.query.action || '';
      const user_id = req.query.user_id || '';
      const start_date = req.query.start_date || '';
      const end_date = req.query.end_date || '';

      const filters = {};
      if (action) filters.action = action;
      if (user_id) filters.user_id = user_id;
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;

      const logsData = await Admin.getAuditLogs(filters, page, limit);

      res.render('admin/system/audit-logs', {
        title: 'Audit Logs - EduLMS',
        layout: 'layouts/admin-layout',
        logs: logsData.logs,
        pagination: {
          current: page,
          pages: logsData.totalPages,
          total: logsData.total
        },
        filters,
        currentPage: 'system'
      });
    } catch (error) {
      console.error('Audit logs error:', error);
      req.flash('error_msg', 'Error loading audit logs');
      res.render('admin/system/audit-logs', {
        title: 'Audit Logs - EduLMS',
        layout: 'layouts/admin-layout',
        logs: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: {},
        currentPage: 'system'
      });
    }
  },

  // Run system maintenance
  runMaintenance: async (req, res) => {
    try {
      const operations = await Admin.runSystemMaintenance();

      req.flash('success_msg', 'System maintenance completed successfully');
      res.json({ success: true, operations });

    } catch (error) {
      console.error('System maintenance error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Export system data
  exportData: async (req, res) => {
    try {
      const { data_type, format } = req.query;

      if (!['users', 'courses', 'payments'].includes(data_type)) {
        return res.status(400).json({ error: 'Invalid data type' });
      }

      const data = await Admin.exportSystemData(data_type, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${data_type}-${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(data);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${data_type}-${new Date().toISOString().split('T')[0]}.json`);
        return res.json(data);
      }

    } catch (error) {
      console.error('Export data error:', error);
      res.status(500).json({ error: 'Error exporting data' });
    }
  }
};

module.exports = adminController;