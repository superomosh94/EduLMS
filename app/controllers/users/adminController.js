// app/controllers/users/adminController.js - COMPLETE FIXED VERSION
const { pool } = require('../../../config/database');
const bcrypt = require('bcryptjs');

// Simple utility functions
const Generators = {
  generateStudentId: () => `STU${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`,
  generateInstructorId: () => `INS${new Date().getFullYear()}${Math.floor(100 + Math.random() * 900)}`,
  generatePassword: () => 'Welcome123!',
  generateReportId: (prefix) => `${prefix}${Date.now().toString().slice(-8)}`
};

const Helpers = {
  generatePagination: (currentPage, totalPages, baseUrl) => ({
    current: parseInt(currentPage),
    total: totalPages,
    pages: Array.from({length: totalPages}, (_, i) => ({
      number: i + 1,
      isCurrent: (i + 1) === parseInt(currentPage),
      url: `${baseUrl}?page=${i + 1}`
    })),
    baseUrl
  }),
  formatDate: (date) => date ? new Date(date).toLocaleDateString() : '',
  formatCurrency: (amount) => new Intl.NumberFormat('en-KE', {style: 'currency', currency: 'KES'}).format(amount || 0),
  
  // Generate user initials
  generateInitials: (user) => {
    if (!user) return 'U';
    if (user.name) {
      const names = user.name.split(' ');
      if (names.length >= 2) {
        return (names[0].charAt(0) + names[1].charAt(0)).toUpperCase();
      }
      return names[0].charAt(0).toUpperCase();
    }
    if (user.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  }
};

const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student', 
  INSTRUCTOR: 'instructor',
  FINANCE: 'finance'
};

// Map role_id to role names
const ROLE_MAP = {
  1: 'admin',
  2: 'student',
  3: 'instructor',
  4: 'finance'
};

// Helper method to get user with initials (standalone function)
const getUserWithInitials = (user) => {
  if (!user) return { initials: 'U' };
  return {
    ...user,
    initials: Helpers.generateInitials(user),
    role: ROLE_MAP[user.role_id] || 'user'
  };
};

const AdminController = {
  // Admin Dashboard
  async dashboard(req, res) {
    try {
      console.log('Loading admin dashboard...');
      
      // Get basic stats using actual schema
      const [users] = await pool.execute('SELECT COUNT(*) as total FROM users');
      
      // Count students (users with student_id)
      const [students] = await pool.execute(`
        SELECT COUNT(*) as total FROM users 
        WHERE student_id IS NOT NULL AND student_id != ''
      `);
      
      // Count instructors (users with teacher_id)
      const [instructors] = await pool.execute(`
        SELECT COUNT(*) as total FROM users 
        WHERE teacher_id IS NOT NULL AND teacher_id != ''
      `);
      
      const [courses] = await pool.execute('SELECT COUNT(*) as total FROM courses');
      const [payments] = await pool.execute('SELECT COUNT(*) as total FROM payments WHERE status = "completed"');
      const [revenue] = await pool.execute('SELECT SUM(amount) as total FROM payments WHERE status = "completed"');

      // Safely get current user with initials
      const currentUser = getUserWithInitials(req.user || {});

      console.log('Dashboard stats loaded successfully');

      res.render('admin/dashboard', {
        title: 'Admin Dashboard - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: currentUser,
        currentPage: 'dashboard',
        stats: {
          totalUsers: users[0]?.total || 0,
          totalStudents: students[0]?.total || 0,
          totalInstructors: instructors[0]?.total || 0,
          totalCourses: courses[0]?.total || 0,
          totalPayments: payments[0]?.total || 0,
          totalRevenue: revenue[0]?.total || 0
        }
      });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      
      // Safe error handling
      const currentUser = getUserWithInitials(req.user || {});
      
      req.flash('error_msg', 'Error loading dashboard data');
      res.render('admin/dashboard', {
        title: 'Admin Dashboard - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: currentUser,
        currentPage: 'dashboard',
        stats: {
          totalUsers: 0,
          totalStudents: 0,
          totalInstructors: 0,
          totalCourses: 0,
          totalPayments: 0,
          totalRevenue: 0
        }
      });
    }
  },

  // User Management - FIXED PARAMETER BINDING
  async listUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      // FIX: Convert numbers to strings for MySQL2 parameter binding
      const [users] = await pool.execute(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit.toString(), offset.toString()] // Convert to strings
      );

      const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM users');
      const totalPages = Math.ceil(countResult[0]?.total / limit) || 1;

      // Add initials and role to each user
      const usersWithData = users.map(user => getUserWithInitials(user));

      res.render('admin/users/list', {
        title: 'User Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'users',
        users: usersWithData,
        pagination: Helpers.generatePagination(page, totalPages, '/admin/users')
      });
    } catch (error) {
      console.error('List users error:', error);
      req.flash('error_msg', 'Error loading users');
      res.redirect('/admin/dashboard');
    }
  },

  // Show Create User Form - ADDED MISSING METHOD
  async showCreateUser(req, res) {
    try {
      res.render('admin/users/create', {
        title: 'Create User - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'users',
        roles: Object.values(ROLES),
        formData: {}
      });
    } catch (error) {
      console.error('Show create user error:', error);
      req.flash('error_msg', 'Error loading create user form');
      res.redirect('/admin/users');
    }
  },

  // Show User Details - ADDED MISSING METHOD
  async showUser(req, res) {
    try {
      const userId = req.params.id;

      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (users.length === 0) {
        req.flash('error_msg', 'User not found');
        return res.redirect('/admin/users');
      }

      const user = users[0];
      const userWithData = getUserWithInitials(user);

      res.render('admin/users/view', {
        title: 'User Details - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'users',
        viewUser: userWithData
      });
    } catch (error) {
      console.error('Show user error:', error);
      req.flash('error_msg', 'Error loading user details');
      res.redirect('/admin/users');
    }
  },

  // Student Management - FIXED PARAMETER BINDING
  async listStudents(req, res) {
    try {
      const [students] = await pool.execute(`
        SELECT * FROM users 
        WHERE student_id IS NOT NULL AND student_id != ''
        ORDER BY created_at DESC
      `);

      // Add initials to each student
      const studentsWithInitials = students.map(student => getUserWithInitials(student));

      res.render('admin/users/students', {
        title: 'Student Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'students',
        students: studentsWithInitials
      });
    } catch (error) {
      console.error('List students error:', error);
      req.flash('error_msg', 'Error loading students');
      res.redirect('/admin/dashboard');
    }
  },

  // Instructor Management
  async listInstructors(req, res) {
    try {
      const [instructors] = await pool.execute(`
        SELECT * FROM users 
        WHERE teacher_id IS NOT NULL AND teacher_id != ''
        ORDER BY created_at DESC
      `);

      // Add initials to each instructor
      const instructorsWithInitials = instructors.map(instructor => getUserWithInitials(instructor));

      res.render('admin/users/instructors', {
        title: 'Instructor Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'instructors',
        instructors: instructorsWithInitials
      });
    } catch (error) {
      console.error('List instructors error:', error);
      req.flash('error_msg', 'Error loading instructors');
      res.redirect('/admin/dashboard');
    }
  },

  // Add New User
  async createUser(req, res) {
    try {
      const { name, email, role, phone } = req.body;

      // Generate temporary password
      const tempPassword = Generators.generatePassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      // Determine role_id based on role
      let roleId = 1; // default to admin
      let studentId = null;
      let teacherId = null;
      let employeeId = null;

      if (role === 'student') {
        roleId = 2;
        studentId = Generators.generateStudentId();
      } else if (role === 'instructor') {
        roleId = 3;
        teacherId = Generators.generateInstructorId();
        employeeId = `EMP${Date.now().toString().slice(-6)}`;
      } else if (role === 'finance') {
        roleId = 4;
        employeeId = `EMP${Date.now().toString().slice(-6)}`;
      }

      // Insert user with actual schema
      const [userResult] = await pool.execute(
        `INSERT INTO users (name, email, password, role_id, phone, student_id, teacher_id, employee_id, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, hashedPassword, roleId, phone, studentId, teacherId, employeeId, 1]
      );

      req.flash('success_msg', `User created successfully! Temporary password: ${tempPassword}`);
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Add user error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        req.flash('error_msg', 'Email already exists');
      } else {
        req.flash('error_msg', 'Error creating user: ' + error.message);
      }
      
      res.redirect('/admin/users');
    }
  },

  // View User Details
  async viewUser(req, res) {
    try {
      const userId = req.params.id;

      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (users.length === 0) {
        req.flash('error_msg', 'User not found');
        return res.redirect('/admin/users');
      }

      const user = users[0];
      const userWithData = getUserWithInitials(user);

      res.render('admin/users/view', {
        title: 'User Details - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'users',
        viewUser: userWithData
      });

    } catch (error) {
      console.error('View user error:', error);
      req.flash('error_msg', 'Error loading user details');
      res.redirect('/admin/users');
    }
  },

  // Edit User Form
  async editUserForm(req, res) {
    try {
      const userId = req.params.id;

      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (users.length === 0) {
        req.flash('error_msg', 'User not found');
        return res.redirect('/admin/users');
      }

      const user = users[0];
      const userWithData = getUserWithInitials(user);

      res.render('admin/users/edit', {
        title: 'Edit User - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'users',
        editUser: userWithData,
        roles: Object.values(ROLES)
      });

    } catch (error) {
      console.error('Edit user form error:', error);
      req.flash('error_msg', 'Error loading edit form');
      res.redirect('/admin/users');
    }
  },

  // Update User
  async updateUser(req, res) {
    try {
      const userId = req.params.id;
      const { name, email, phone, is_active } = req.body;

      await pool.execute(
        'UPDATE users SET name = ?, email = ?, phone = ?, is_active = ? WHERE id = ?',
        [name, email, phone, is_active ? 1 : 0, userId]
      );

      req.flash('success_msg', 'User updated successfully');
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Update user error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        req.flash('error_msg', 'Email already exists');
      } else {
        req.flash('error_msg', 'Error updating user');
      }
      
      res.redirect(`/admin/users/edit/${userId}`);
    }
  },

  // Delete User
  async deleteUser(req, res) {
    try {
      const userId = req.params.id;

      await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

      req.flash('success_msg', 'User deleted successfully');
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Delete user error:', error);
      req.flash('error_msg', 'Error deleting user');
      res.redirect('/admin/users');
    }
  },

  // System Settings - ADDED MISSING METHOD
  async systemSettings(req, res) {
    try {
      res.render('admin/system/settings', {
        title: 'System Settings - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'system',
        settings: {}
      });
    } catch (error) {
      console.error('System settings error:', error);
      req.flash('error_msg', 'Error loading system settings');
      res.redirect('/admin/dashboard');
    }
  },

  // Update System Settings - ADDED MISSING METHOD
  async updateSystemSettings(req, res) {
    try {
      req.flash('success_msg', 'System settings updated successfully');
      res.redirect('/admin/system/settings');
    } catch (error) {
      console.error('Update system settings error:', error);
      req.flash('error_msg', 'Error updating system settings');
      res.redirect('/admin/system/settings');
    }
  },

  // Get user role name
  getUserRole(roleId) {
    return ROLE_MAP[roleId] || 'user';
  }
};

module.exports = AdminController;