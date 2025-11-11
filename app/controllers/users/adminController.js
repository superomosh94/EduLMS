// app/controllers/users/adminController.js - SIMPLIFIED WORKING VERSION
const db = require('../../../config/database');
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
  formatCurrency: (amount) => new Intl.NumberFormat('en-KE', {style: 'currency', currency: 'KES'}).format(amount || 0)
};

const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
  FINANCE: 'finance'
};

class AdminController {
  // Admin Dashboard
  async dashboard(req, res) {
    try {
      // Get basic stats using direct database queries
      const [users] = await db.promise().execute('SELECT COUNT(*) as total FROM users');
      const [students] = await db.promise().execute('SELECT COUNT(*) as total FROM users WHERE role = "student"');
      const [instructors] = await db.promise().execute('SELECT COUNT(*) as total FROM users WHERE role = "instructor"');
      const [courses] = await db.promise().execute('SELECT COUNT(*) as total FROM courses');
      const [payments] = await db.promise().execute('SELECT COUNT(*) as total FROM payments WHERE status = "completed"');
      const [revenue] = await db.promise().execute('SELECT SUM(amount) as total FROM payments WHERE status = "completed"');

      res.render('admin/dashboard', {
        title: 'Admin Dashboard - EduLMS',
        layout: 'layouts/admin-layout',
        stats: {
          totalUsers: users[0].total,
          totalStudents: students[0].total,
          totalInstructors: instructors[0].total,
          totalCourses: courses[0].total,
          totalPayments: payments[0].total,
          totalRevenue: revenue[0].total || 0
        }
      });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      req.flash('error_msg', 'Error loading dashboard');
      res.render('admin/dashboard', {
        title: 'Admin Dashboard - EduLMS',
        layout: 'layouts/admin-layout',
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
  }

  // User Management
  async listUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      const [users] = await db.promise().execute(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );

      const [countResult] = await db.promise().execute('SELECT COUNT(*) as total FROM users');
      const totalPages = Math.ceil(countResult[0].total / limit);

      res.render('admin/users/list', {
        title: 'User Management - EduLMS',
        layout: 'layouts/admin-layout',
        users: users,
        pagination: Helpers.generatePagination(page, totalPages, '/admin/users')
      });
    } catch (error) {
      console.error('List users error:', error);
      req.flash('error_msg', 'Error loading users');
      res.redirect('/admin/dashboard');
    }
  }

  // Student Management
  async listStudents(req, res) {
    try {
      const [students] = await db.promise().execute(`
        SELECT u.*, s.student_id 
        FROM users u 
        LEFT JOIN students s ON u.id = s.user_id 
        WHERE u.role = 'student'
        ORDER BY u.created_at DESC
      `);

      res.render('admin/users/students', {
        title: 'Student Management - EduLMS',
        layout: 'layouts/admin-layout',
        students: students
      });
    } catch (error) {
      console.error('List students error:', error);
      req.flash('error_msg', 'Error loading students');
      res.redirect('/admin/dashboard');
    }
  }

  // Add more methods as needed...

}

module.exports = new AdminController();