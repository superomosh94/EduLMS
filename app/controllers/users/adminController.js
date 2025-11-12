// app/controllers/users/adminController.js - UPDATED FOR PROMISE POOL
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
    if (user.firstName && user.lastName) {
      return (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
    }
    if (user.username) return user.username.charAt(0).toUpperCase();
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

class AdminController {
  // Admin Dashboard
  async dashboard(req, res) {
    try {
      // Get basic stats using promise pool
      const [users] = await pool.execute('SELECT COUNT(*) as total FROM users');
      const [students] = await pool.execute('SELECT COUNT(*) as total FROM users WHERE role = "student"');
      const [instructors] = await pool.execute('SELECT COUNT(*) as total FROM users WHERE role = "instructor"');
      const [courses] = await pool.execute('SELECT COUNT(*) as total FROM courses');
      const [payments] = await pool.execute('SELECT COUNT(*) as total FROM payments WHERE status = "completed"');
      const [revenue] = await pool.execute('SELECT SUM(amount) as total FROM payments WHERE status = "completed"');

      // Generate initials for current user
      const userWithInitials = {
        ...req.user,
        initials: Helpers.generateInitials(req.user)
      };

      res.render('admin/dashboard', {
        title: 'Admin Dashboard - EduLMS',
        layout: 'layouts/admin-layout',
        user: userWithInitials,
        currentPage: 'dashboard',
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
      
      // Generate initials even on error
      const userWithInitials = {
        ...req.user,
        initials: Helpers.generateInitials(req.user)
      };

      req.flash('error_msg', 'Error loading dashboard');
      res.render('admin/dashboard', {
        title: 'Admin Dashboard - EduLMS',
        layout: 'layouts/admin-layout',
        user: userWithInitials,
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
  }

  // User Management
  async listUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      const [users] = await pool.execute(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );

      const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM users');
      const totalPages = Math.ceil(countResult[0].total / limit);

      // Add initials to each user
      const usersWithInitials = users.map(user => ({
        ...user,
        initials: Helpers.generateInitials(user)
      }));

      res.render('admin/users/list', {
        title: 'User Management - EduLMS',
        layout: 'layouts/admin-layout',
        user: {
          ...req.user,
          initials: Helpers.generateInitials(req.user)
        },
        currentPage: 'users',
        users: usersWithInitials,
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
      const [students] = await pool.execute(`
        SELECT u.*, s.student_id 
        FROM users u 
        LEFT JOIN students s ON u.id = s.user_id 
        WHERE u.role = 'student'
        ORDER BY u.created_at DESC
      `);

      // Add initials to each student
      const studentsWithInitials = students.map(student => ({
        ...student,
        initials: Helpers.generateInitials(student)
      }));

      res.render('admin/users/students', {
        title: 'Student Management - EduLMS',
        layout: 'layouts/admin-layout',
        user: {
          ...req.user,
          initials: Helpers.generateInitials(req.user)
        },
        currentPage: 'students',
        students: studentsWithInitials
      });
    } catch (error) {
      console.error('List students error:', error);
      req.flash('error_msg', 'Error loading students');
      res.redirect('/admin/dashboard');
    }
  }

  // Instructor Management
  async listInstructors(req, res) {
    try {
      const [instructors] = await pool.execute(`
        SELECT u.*, i.instructor_id 
        FROM users u 
        LEFT JOIN instructors i ON u.id = i.user_id 
        WHERE u.role = 'instructor'
        ORDER BY u.created_at DESC
      `);

      // Add initials to each instructor
      const instructorsWithInitials = instructors.map(instructor => ({
        ...instructor,
        initials: Helpers.generateInitials(instructor)
      }));

      res.render('admin/users/instructors', {
        title: 'Instructor Management - EduLMS',
        layout: 'layouts/admin-layout',
        user: {
          ...req.user,
          initials: Helpers.generateInitials(req.user)
        },
        currentPage: 'instructors',
        instructors: instructorsWithInitials
      });
    } catch (error) {
      console.error('List instructors error:', error);
      req.flash('error_msg', 'Error loading instructors');
      res.redirect('/admin/dashboard');
    }
  }

  // Add New User
  async addUser(req, res) {
    try {
      const { firstName, lastName, email, role, phone } = req.body;

      // Generate temporary password
      const tempPassword = Generators.generatePassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      // Start transaction
      const result = await pool.transaction(async (connection) => {
        // Insert user
        const [userResult] = await connection.execute(
          'INSERT INTO users (firstName, lastName, email, password, role, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [firstName, lastName, email, hashedPassword, role, phone, 'active']
        );

        const userId = userResult.insertId;

        // Create role-specific record
        if (role === 'student') {
          const studentId = Generators.generateStudentId();
          await connection.execute(
            'INSERT INTO students (user_id, student_id) VALUES (?, ?)',
            [userId, studentId]
          );
        } else if (role === 'instructor') {
          const instructorId = Generators.generateInstructorId();
          await connection.execute(
            'INSERT INTO instructors (user_id, instructor_id) VALUES (?, ?)',
            [userId, instructorId]
          );
        }

        return { userId, tempPassword };
      });

      req.flash('success_msg', `User created successfully! Temporary password: ${result.tempPassword}`);
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Add user error:', error);
      req.flash('error_msg', 'Error creating user');
      res.redirect('/admin/users');
    }
  }

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
      const userWithInitials = {
        ...user,
        initials: Helpers.generateInitials(user)
      };

      // Get additional role-specific data
      let roleData = null;
      if (user.role === 'student') {
        const [studentData] = await pool.execute(
          'SELECT * FROM students WHERE user_id = ?', 
          [userId]
        );
        roleData = studentData[0];
      } else if (user.role === 'instructor') {
        const [instructorData] = await pool.execute(
          'SELECT * FROM instructors WHERE user_id = ?', 
          [userId]
        );
        roleData = instructorData[0];
      }

      res.render('admin/users/view', {
        title: 'User Details - EduLMS',
        layout: 'layouts/admin-layout',
        user: {
          ...req.user,
          initials: Helpers.generateInitials(req.user)
        },
        currentPage: 'users',
        viewUser: userWithInitials,
        roleData: roleData
      });

    } catch (error) {
      console.error('View user error:', error);
      req.flash('error_msg', 'Error loading user details');
      res.redirect('/admin/users');
    }
  }
}

module.exports = new AdminController();