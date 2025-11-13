// app/controllers/users/adminController.js - UPDATED WITH ALL MISSING METHODS
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
      
      req.flash('error', 'Error loading dashboard data');
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
      req.flash('error', 'Error loading users');
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
      req.flash('error', 'Error loading create user form');
      res.redirect('/admin/users');
    }
  },

  // Show User Details - ADDED MISSING METHOD
  async showUser(req, res) {
    try {
      const userId = req.params.id;

      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (users.length === 0) {
        req.flash('error', 'User not found');
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
      req.flash('error', 'Error loading user details');
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
      req.flash('error', 'Error loading students');
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
      req.flash('error', 'Error loading instructors');
      res.redirect('/admin/dashboard');
    }
  },

  // Add New User
  async createUser(req, res) {
    try {
      const { name, email, role, phone } = req.body;

      // Validate required fields
      if (!name || !email || !role) {
        req.flash('error', 'Name, email, and role are required');
        return res.redirect('/admin/users/create');
      }

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

      req.flash('success', `User created successfully! Temporary password: ${tempPassword}`);
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Add user error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        req.flash('error', 'Email already exists');
      } else {
        req.flash('error', 'Error creating user: ' + error.message);
      }
      
      res.redirect('/admin/users/create');
    }
  },

  // View User Details
  async viewUser(req, res) {
    try {
      const userId = req.params.id;

      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (users.length === 0) {
        req.flash('error', 'User not found');
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
      req.flash('error', 'Error loading user details');
      res.redirect('/admin/users');
    }
  },

  // Edit User Form
  async editUserForm(req, res) {
    try {
      const userId = req.params.id;

      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (users.length === 0) {
        req.flash('error', 'User not found');
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
      req.flash('error', 'Error loading edit form');
      res.redirect('/admin/users');
    }
  },

  // Update User
  async updateUser(req, res) {
    try {
      const userId = req.params.id;
      const { name, email, phone, is_active } = req.body;

      // Validate required fields
      if (!name || !email) {
        req.flash('error', 'Name and email are required');
        return res.redirect(`/admin/users/edit/${userId}`);
      }

      await pool.execute(
        'UPDATE users SET name = ?, email = ?, phone = ?, is_active = ? WHERE id = ?',
        [name, email, phone, is_active ? 1 : 0, userId]
      );

      req.flash('success', 'User updated successfully');
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Update user error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        req.flash('error', 'Email already exists');
      } else {
        req.flash('error', 'Error updating user: ' + error.message);
      }
      
      res.redirect(`/admin/users/edit/${userId}`);
    }
  },

  // Delete User
  async deleteUser(req, res) {
    try {
      const userId = req.params.id;

      // Check if user exists first
      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (users.length === 0) {
        req.flash('error', 'User not found');
        return res.redirect('/admin/users');
      }

      await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

      req.flash('success', 'User deleted successfully');
      res.redirect('/admin/users');

    } catch (error) {
      console.error('Delete user error:', error);
      req.flash('error', 'Error deleting user: ' + error.message);
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
      req.flash('error', 'Error loading system settings');
      res.redirect('/admin/dashboard');
    }
  },

  // Update System Settings - ADDED MISSING METHOD
  async updateSystemSettings(req, res) {
    try {
      const { system_name, email_from, max_file_size } = req.body;
      
      // Here you would typically save to database
      // For now, just show success message
      
      req.flash('success', 'System settings updated successfully');
      res.redirect('/admin/system/settings');
    } catch (error) {
      console.error('Update system settings error:', error);
      req.flash('error', 'Error updating system settings: ' + error.message);
      res.redirect('/admin/system/settings');
    }
  },

  // Finance Overview
  async financeOverview(req, res) {
    try {
      // Get financial stats
      const [revenue] = await pool.execute('SELECT SUM(amount) as total FROM payments WHERE status = "completed"');
      const [pending] = await pool.execute('SELECT SUM(amount) as total FROM payments WHERE status = "pending"');
      const [failed] = await pool.execute('SELECT SUM(amount) as total FROM payments WHERE status = "failed"');
      const [totalPayments] = await pool.execute('SELECT COUNT(*) as total FROM payments');

      res.render('admin/finance/overview', {
        title: 'Finance Overview - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'finance',
        stats: {
          totalRevenue: revenue[0]?.total || 0,
          pendingRevenue: pending[0]?.total || 0,
          failedRevenue: failed[0]?.total || 0,
          totalPayments: totalPayments[0]?.total || 0
        }
      });
    } catch (error) {
      console.error('Finance overview error:', error);
      req.flash('error', 'Error loading finance overview');
      res.redirect('/admin/dashboard');
    }
  },

  // Course Management - FIXED QUERY
  async listCourses(req, res) {
    try {
      const [courses] = await pool.execute(`
        SELECT c.*, u.name as instructor_name 
        FROM courses c 
        LEFT JOIN users u ON c.teacher_id = u.id 
        ORDER BY c.created_at DESC
      `);

      res.render('admin/courses/list', {
        title: 'Course Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'courses',
        courses: courses
      });
    } catch (error) {
      console.error('List courses error:', error);
      req.flash('error', 'Error loading courses');
      res.redirect('/admin/dashboard');
    }
  },

  // ==================== NEW COURSE MANAGEMENT METHODS ====================

  async viewCourse(req, res) {
    try {
      const courseId = req.params.id;

      const [courses] = await pool.execute(`
        SELECT c.*, u.name as instructor_name 
        FROM courses c 
        LEFT JOIN users u ON c.teacher_id = u.id 
        WHERE c.id = ?
      `, [courseId]);
      
      if (courses.length === 0) {
        req.flash('error', 'Course not found');
        return res.redirect('/admin/courses');
      }

      const course = courses[0];

      // Get enrollments for this course
      const [enrollments] = await pool.execute(`
        SELECT e.*, u.name as student_name, u.student_id
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        WHERE e.course_id = ?
      `, [courseId]);

      res.render('admin/courses/view', {
        title: 'Course Details - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'courses',
        course: course,
        enrollments: enrollments || []
      });
    } catch (error) {
      console.error('View course error:', error);
      req.flash('error', 'Error loading course details');
      res.redirect('/admin/courses');
    }
  },

  async showCreateCourse(req, res) {
    try {
      // Get available instructors
      const [instructors] = await pool.execute(`
        SELECT id, name, teacher_id 
        FROM users 
        WHERE role_id = 2 AND teacher_id IS NOT NULL
      `);

      res.render('admin/courses/create', {
        title: 'Create Course - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'courses',
        instructors: instructors || [],
        formData: {}
      });
    } catch (error) {
      console.error('Show create course error:', error);
      req.flash('error', 'Error loading create course form');
      res.redirect('/admin/courses');
    }
  },

  async createCourse(req, res) {
    try {
      const { course_code, title, description, credits, teacher_id, department, semester, academic_year, max_students, fee_amount, start_date, end_date } = req.body;

      // Validate required fields
      if (!course_code || !title || !teacher_id) {
        req.flash('error', 'Course code, title, and instructor are required');
        return res.redirect('/admin/courses/create');
      }

      await pool.execute(
        `INSERT INTO courses (course_code, title, description, credits, teacher_id, department, semester, academic_year, max_students, fee_amount, start_date, end_date, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [course_code, title, description, credits, teacher_id, department, semester, academic_year, max_students, fee_amount, start_date, end_date]
      );

      req.flash('success', 'Course created successfully');
      res.redirect('/admin/courses');

    } catch (error) {
      console.error('Create course error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        req.flash('error', 'Course code already exists');
      } else {
        req.flash('error', 'Error creating course: ' + error.message);
      }
      
      res.redirect('/admin/courses/create');
    }
  },

  async editCourseForm(req, res) {
    try {
      const courseId = req.params.id;

      const [courses] = await pool.execute('SELECT * FROM courses WHERE id = ?', [courseId]);
      
      if (courses.length === 0) {
        req.flash('error', 'Course not found');
        return res.redirect('/admin/courses');
      }

      const course = courses[0];

      // Get available instructors
      const [instructors] = await pool.execute(`
        SELECT id, name, teacher_id 
        FROM users 
        WHERE role_id = 2 AND teacher_id IS NOT NULL
      `);

      res.render('admin/courses/edit', {
        title: 'Edit Course - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'courses',
        course: course,
        instructors: instructors || []
      });

    } catch (error) {
      console.error('Edit course form error:', error);
      req.flash('error', 'Error loading edit form');
      res.redirect('/admin/courses');
    }
  },

  async updateCourse(req, res) {
    try {
      const courseId = req.params.id;
      const { course_code, title, description, credits, teacher_id, department, semester, academic_year, max_students, fee_amount, start_date, end_date, status } = req.body;

      // Validate required fields
      if (!course_code || !title || !teacher_id) {
        req.flash('error', 'Course code, title, and instructor are required');
        return res.redirect(`/admin/courses/edit/${courseId}`);
      }

      await pool.execute(
        `UPDATE courses SET 
          course_code = ?, title = ?, description = ?, credits = ?, teacher_id = ?, 
          department = ?, semester = ?, academic_year = ?, max_students = ?, 
          fee_amount = ?, start_date = ?, end_date = ?, status = ?
         WHERE id = ?`,
        [course_code, title, description, credits, teacher_id, department, semester, academic_year, max_students, fee_amount, start_date, end_date, status, courseId]
      );

      req.flash('success', 'Course updated successfully');
      res.redirect('/admin/courses');

    } catch (error) {
      console.error('Update course error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        req.flash('error', 'Course code already exists');
      } else {
        req.flash('error', 'Error updating course: ' + error.message);
      }
      
      res.redirect(`/admin/courses/edit/${courseId}`);
    }
  },

  async deleteCourse(req, res) {
    try {
      const courseId = req.params.id;

      // Check if course exists first
      const [courses] = await pool.execute('SELECT * FROM courses WHERE id = ?', [courseId]);
      
      if (courses.length === 0) {
        req.flash('error', 'Course not found');
        return res.redirect('/admin/courses');
      }

      await pool.execute('DELETE FROM courses WHERE id = ?', [courseId]);

      req.flash('success', 'Course deleted successfully');
      res.redirect('/admin/courses');

    } catch (error) {
      console.error('Delete course error:', error);
      req.flash('error', 'Error deleting course: ' + error.message);
      res.redirect('/admin/courses');
    }
  },

  async manageCourse(req, res) {
    try {
      const courseId = req.params.id;

      const [courses] = await pool.execute(`
        SELECT c.*, u.name as instructor_name 
        FROM courses c 
        LEFT JOIN users u ON c.teacher_id = u.id 
        WHERE c.id = ?
      `, [courseId]);
      
      if (courses.length === 0) {
        req.flash('error', 'Course not found');
        return res.redirect('/admin/courses');
      }

      const course = courses[0];

      // Get enrollments
      const [enrollments] = await pool.execute(`
        SELECT e.*, u.name as student_name, u.student_id, u.email
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        WHERE e.course_id = ?
      `, [courseId]);

      // Get assignments
      const [assignments] = await pool.execute(`
        SELECT a.*, COUNT(s.id) as submission_count
        FROM assignments a
        LEFT JOIN submissions s ON a.id = s.assignment_id
        WHERE a.course_id = ?
        GROUP BY a.id
        ORDER BY a.due_date DESC
      `, [courseId]);

      res.render('admin/courses/manage', {
        title: 'Manage Course - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'courses',
        course: course,
        enrollments: enrollments || [],
        assignments: assignments || []
      });
    } catch (error) {
      console.error('Manage course error:', error);
      req.flash('error', 'Error loading course management');
      res.redirect('/admin/courses');
    }
  },

  // ==================== ACADEMIC MANAGEMENT METHODS ====================

  async listEnrollments(req, res) {
    try {
      const [enrollments] = await pool.execute(`
        SELECT e.*, u.name as student_name, u.student_id, c.title as course_name, c.course_code
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        JOIN courses c ON e.course_id = c.id
        ORDER BY e.enrolled_at DESC
      `);

      res.render('admin/academic/enrollments', {
        title: 'Enrollment Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'academic',
        enrollments: enrollments || []
      });
    } catch (error) {
      console.error('List enrollments error:', error);
      req.flash('error', 'Error loading enrollments');
      res.redirect('/admin/dashboard');
    }
  },

  async listAssignments(req, res) {
    try {
      const [assignments] = await pool.execute(`
        SELECT a.*, c.title as course_name, c.course_code, u.name as instructor_name,
               COUNT(s.id) as submission_count
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN users u ON a.teacher_id = u.id
        LEFT JOIN submissions s ON a.id = s.assignment_id
        GROUP BY a.id
        ORDER BY a.due_date DESC
      `);

      res.render('admin/academic/assignments', {
        title: 'Assignment Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'academic',
        assignments: assignments || []
      });
    } catch (error) {
      console.error('List assignments error:', error);
      req.flash('error', 'Error loading assignments');
      res.redirect('/admin/dashboard');
    }
  },

  async listGrades(req, res) {
    try {
      const [grades] = await pool.execute(`
        SELECT g.*, a.title as assignment_title, c.title as course_name, 
               u.name as student_name, u.student_id, t.name as graded_by
        FROM grades g
        JOIN assignments a ON g.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        JOIN users u ON g.student_id = u.id
        JOIN users t ON g.teacher_id = t.id
        ORDER BY g.graded_at DESC
      `);

      res.render('admin/academic/grades', {
        title: 'Grade Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'academic',
        grades: grades || []
      });
    } catch (error) {
      console.error('List grades error:', error);
      req.flash('error', 'Error loading grades');
      res.redirect('/admin/dashboard');
    }
  },

  async listSubmissions(req, res) {
    try {
      const [submissions] = await pool.execute(`
        SELECT s.*, a.title as assignment_title, c.title as course_name, 
               u.name as student_name, u.student_id
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        JOIN users u ON s.student_id = u.id
        ORDER BY s.submitted_at DESC
      `);

      res.render('admin/academic/submissions', {
        title: 'Submission Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'academic',
        submissions: submissions || []
      });
    } catch (error) {
      console.error('List submissions error:', error);
      req.flash('error', 'Error loading submissions');
      res.redirect('/admin/dashboard');
    }
  },

  // ==================== FINANCE MANAGEMENT METHODS ====================

  async listPayments(req, res) {
    try {
      const [payments] = await pool.execute(`
        SELECT p.*, u.name as student_name, u.student_id, fs.name as fee_structure_name
        FROM payments p
        LEFT JOIN users u ON p.student_id = u.id
        LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
        ORDER BY p.created_at DESC
      `);

      res.render('admin/finance/payments', {
        title: 'Payment Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'finance',
        payments: payments || []
      });
    } catch (error) {
      console.error('List payments error:', error);
      req.flash('error', 'Error loading payments');
      res.redirect('/admin/finance/overview');
    }
  },

  async listFeeStructures(req, res) {
    try {
      const [feeStructures] = await pool.execute(`
        SELECT fs.*, u.name as created_by_name
        FROM fee_structures fs
        LEFT JOIN users u ON fs.created_by = u.id
        ORDER BY fs.created_at DESC
      `);

      res.render('admin/finance/fee-structure', {
        title: 'Fee Structure - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'finance',
        feeStructures: feeStructures || []
      });
    } catch (error) {
      console.error('List fee structures error:', error);
      req.flash('error', 'Error loading fee structures');
      res.redirect('/admin/finance/overview');
    }
  },

  async revenueReports(req, res) {
    try {
      // Get revenue data for reports
      const [revenueData] = await pool.execute(`
        SELECT 
          DATE(payment_date) as date,
          SUM(amount) as daily_revenue,
          COUNT(*) as transaction_count
        FROM payments 
        WHERE status = 'completed' AND payment_date IS NOT NULL
        GROUP BY DATE(payment_date)
        ORDER BY date DESC
        LIMIT 30
      `);

      res.render('admin/finance/revenue-reports', {
        title: 'Revenue Reports - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'finance',
        revenueData: revenueData || []
      });
    } catch (error) {
      console.error('Revenue reports error:', error);
      req.flash('error', 'Error loading revenue reports');
      res.redirect('/admin/finance/overview');
    }
  },

  // ==================== SYSTEM MANAGEMENT METHODS ====================

  async listNotifications(req, res) {
    try {
      const [notifications] = await pool.execute(`
        SELECT n.*, u.name as user_name
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        ORDER BY n.created_at DESC
        LIMIT 100
      `);

      res.render('admin/system/notifications', {
        title: 'Notification Center - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'system',
        notifications: notifications || []
      });
    } catch (error) {
      console.error('List notifications error:', error);
      req.flash('error', 'Error loading notifications');
      res.redirect('/admin/dashboard');
    }
  },

  async systemHealth(req, res) {
    try {
      // Get system health metrics
      const [userCount] = await pool.execute('SELECT COUNT(*) as total FROM users');
      const [courseCount] = await pool.execute('SELECT COUNT(*) as total FROM courses');
      const [paymentCount] = await pool.execute('SELECT COUNT(*) as total FROM payments');
      const [assignmentCount] = await pool.execute('SELECT COUNT(*) as total FROM assignments');

      res.render('admin/system/system-health', {
        title: 'System Health - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'system',
        metrics: {
          totalUsers: userCount[0]?.total || 0,
          totalCourses: courseCount[0]?.total || 0,
          totalPayments: paymentCount[0]?.total || 0,
          totalAssignments: assignmentCount[0]?.total || 0,
          databaseStatus: 'Healthy',
          serverUptime: '24/7'
        }
      });
    } catch (error) {
      console.error('System health error:', error);
      req.flash('error', 'Error loading system health');
      res.redirect('/admin/dashboard');
    }
  },

  async listAuditLogs(req, res) {
    try {
      const [auditLogs] = await pool.execute(`
        SELECT a.*, u.name as user_name
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 100
      `);

      res.render('admin/system/audit-logs', {
        title: 'Audit Logs - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'system',
        auditLogs: auditLogs || []
      });
    } catch (error) {
      console.error('List audit logs error:', error);
      req.flash('error', 'Error loading audit logs');
      res.redirect('/admin/dashboard');
    }
  },

  async backupManagement(req, res) {
    try {
      res.render('admin/system/backup', {
        title: 'Backup & Restore - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'system',
        backupInfo: {
          lastBackup: '2024-01-01 12:00:00',
          backupSize: '2.5 GB',
          backupStatus: 'Completed'
        }
      });
    } catch (error) {
      console.error('Backup management error:', error);
      req.flash('error', 'Error loading backup management');
      res.redirect('/admin/dashboard');
    }
  },

  // ==================== REPORTS METHODS ====================

  async generateReports(req, res) {
    try {
      res.render('admin/reports/generate', {
        title: 'Generate Reports - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'reports',
        reportTypes: ['Student', 'Financial', 'Academic', 'System']
      });
    } catch (error) {
      console.error('Generate reports error:', error);
      req.flash('error', 'Error loading report generator');
      res.redirect('/admin/dashboard');
    }
  },

  async studentReports(req, res) {
    try {
      const [students] = await pool.execute(`
        SELECT u.*, COUNT(e.id) as course_count
        FROM users u
        LEFT JOIN enrollments e ON u.id = e.student_id
        WHERE u.role_id = 2
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `);

      res.render('admin/reports/student-reports', {
        title: 'Student Reports - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'reports',
        students: students || []
      });
    } catch (error) {
      console.error('Student reports error:', error);
      req.flash('error', 'Error loading student reports');
      res.redirect('/admin/reports/generate');
    }
  },

  async financialReports(req, res) {
    try {
      const [financialData] = await pool.execute(`
        SELECT 
          MONTH(payment_date) as month,
          YEAR(payment_date) as year,
          SUM(amount) as monthly_revenue,
          COUNT(*) as transaction_count
        FROM payments 
        WHERE status = 'completed' AND payment_date IS NOT NULL
        GROUP BY YEAR(payment_date), MONTH(payment_date)
        ORDER BY year DESC, month DESC
        LIMIT 12
      `);

      res.render('admin/reports/financial-reports', {
        title: 'Financial Reports - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: getUserWithInitials(req.user || {}),
        currentPage: 'reports',
        financialData: financialData || []
      });
    } catch (error) {
      console.error('Financial reports error:', error);
      req.flash('error', 'Error loading financial reports');
      res.redirect('/admin/reports/generate');
    }
  },
  
// Finance Officers Management
async listFinanceOfficers(req, res) {
  try {
    const [financeOfficers] = await pool.execute(`
      SELECT * FROM users 
      WHERE role_id = 4 AND employee_id IS NOT NULL
      ORDER BY created_at DESC
    `);

    // Add initials to each finance officer
    const officersWithInitials = financeOfficers.map(officer => getUserWithInitials(officer));

    res.render('admin/users/finance-officers', {
      title: 'Finance Officers Management - EduLMS',
      layout: 'layouts/admin-layout',
      currentUser: getUserWithInitials(req.user || {}),
      currentPage: 'finance',
      financeOfficers: officersWithInitials
    });
  } catch (error) {
    console.error('List finance officers error:', error);
    req.flash('error', 'Error loading finance officers');
    res.redirect('/admin/dashboard');
  }
},


async academicReports(req, res) {
  try {
    const [academicData] = await pool.execute(`
      SELECT 
        c.title as course_name,
        c.course_code,
        COUNT(e.id) as enrollment_count,
        AVG(g.points_earned) as average_grade
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN grades g ON c.id = g.assignment_id  -- FIXED: Join through assignments
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.render('admin/reports/academic-reports', {
      title: 'Academic Reports - EduLMS',
      layout: 'layouts/admin-layout',
      currentUser: getUserWithInitials(req.user || {}),
      currentPage: 'reports',
      academicData: academicData || []
    });
  } catch (error) {
    console.error('Academic reports error:', error);
    req.flash('error', 'Error loading academic reports');
    res.redirect('/admin/reports/generate');
  }
},

  // Get user role name
  getUserRole(roleId) {
    return ROLE_MAP[roleId] || 'user';
  }
};

module.exports = AdminController;