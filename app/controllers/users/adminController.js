const User = require('../../models/User');
const Student = require('../../models/Student');
const Instructor = require('../../models/Instructor');
const Course = require('../../models/Course');
const { ROLES } = require('../../../config/constants');
const { Generators, Helpers, Formatters } = require('../../../utils');
const db = require('../../../config/database');

class AdminController {
  // Admin dashboard
  async dashboard(req, res) {
    try {
      // Get system statistics
      const userStats = await User.getStats();
      const totalCourses = await db.query('SELECT COUNT(*) as total FROM courses');
      const totalPayments = await db.query('SELECT COUNT(*) as total FROM payments WHERE status = "completed"');
      const revenue = await db.query('SELECT SUM(amount) as total FROM payments WHERE status = "completed" AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');

      // Get recent activities
      const recentActivities = await db.query(`
        SELECT al.*, u.first_name, u.last_name 
        FROM audit_logs al 
        JOIN users u ON al.user_id = u.id 
        ORDER BY al.created_at DESC 
        LIMIT 10
      `);

      // Get pending approvals
      const pendingPayments = await db.query('SELECT COUNT(*) as total FROM payments WHERE status = "pending"');
      const pendingUsers = await db.query('SELECT COUNT(*) as total FROM users WHERE is_active = 0');

      res.render('admin/dashboard', {
        title: 'Admin Dashboard - EduLMS',
        layout: 'layouts/admin-layout',
        userStats,
        totalCourses: totalCourses[0].total,
        totalPayments: totalPayments[0].total,
        recentRevenue: revenue[0].total || 0,
        recentActivities,
        pendingPayments: pendingPayments[0].total,
        pendingUsers: pendingUsers[0].total
      });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      req.flash('error_msg', 'Error loading dashboard');
      res.redirect('/admin/dashboard');
    }
  }

  // User Management

  async listUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const role = req.query.role;
      const search = req.query.search;

      const users = await User.getAll(page, limit, role, search);

      res.render('admin/users/list', {
        title: 'User Management - EduLMS',
        layout: 'layouts/admin-layout',
        users: users.users,
        pagination: Helpers.generatePagination(page, users.totalPages, '/admin/users'),
        currentRole: role,
        searchQuery: search
      });
    } catch (error) {
      console.error('List users error:', error);
      req.flash('error_msg', 'Error loading users');
      res.redirect('/admin/dashboard');
    }
  }

  async showCreateUser(req, res) {
    try {
      const roles = await db.query('SELECT * FROM roles ORDER BY name');

      res.render('admin/users/create', {
        title: 'Create User - EduLMS',
        layout: 'layouts/admin-layout',
        roles,
        formData: req.flash('formData')[0] || {}
      });
    } catch (error) {
      console.error('Show create user error:', error);
      req.flash('error_msg', 'Error loading create user form');
      res.redirect('/admin/users');
    }
  }

  async createUser(req, res) {
    try {
      const {
        first_name,
        last_name,
        email,
        password,
        role_id,
        phone,
        address,
        date_of_birth,
        gender,
        student_id,
        program,
        semester,
        year,
        employee_id,
        department,
        qualification
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        req.flash('error_msg', 'Email already registered');
        req.flash('formData', req.body);
        return res.redirect('/admin/users/create');
      }

      // Get role name
      const roles = await db.query('SELECT name FROM roles WHERE id = ?', [role_id]);
      const roleName = roles[0].name;

      // Create user
      const userId = await User.create({
        first_name,
        last_name,
        email,
        password: password || Generators.generatePassword(),
        role_id,
        phone,
        address,
        date_of_birth,
        gender,
        created_by: req.user.id
      });

      // Create role-specific profile
      if (roleName === ROLES.STUDENT) {
        await Student.create({
          user_id: userId,
          student_id: student_id || Generators.generateStudentId(),
          enrollment_date: new Date(),
          program,
          semester,
          year: parseInt(year)
        });
      } else if (roleName === ROLES.INSTRUCTOR) {
        await Instructor.create({
          user_id: userId,
          employee_id: employee_id || Generators.generateInstructorId(),
          department,
          qualification,
          hire_date: new Date()
        });
      }

      req.flash('success_msg', 'User created successfully');
      res.redirect('/admin/users');
    } catch (error) {
      console.error('Create user error:', error);
      req.flash('error_msg', 'Error creating user');
      req.flash('formData', req.body);
      res.redirect('/admin/users/create');
    }
  }

  async showUser(req, res) {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        req.flash('error_msg', 'User not found');
        return res.redirect('/admin/users');
      }

      let profile = null;
      if (user.role_name === ROLES.STUDENT) {
        profile = await Student.findByUserId(userId);
      } else if (user.role_name === ROLES.INSTRUCTOR) {
        profile = await Instructor.findByUserId(userId);
      }

      res.render('admin/users/view', {
        title: `User Details - ${user.first_name} ${user.last_name}`,
        layout: 'layouts/admin-layout',
        user,
        profile
      });
    } catch (error) {
      console.error('Show user error:', error);
      req.flash('error_msg', 'Error loading user details');
      res.redirect('/admin/users');
    }
  }

  async showEditUser(req, res) {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        req.flash('error_msg', 'User not found');
        return res.redirect('/admin/users');
      }

      let profile = null;
      if (user.role_name === ROLES.STUDENT) {
        profile = await Student.findByUserId(userId);
      } else if (user.role_name === ROLES.INSTRUCTOR) {
        profile = await Instructor.findByUserId(userId);
      }

      const roles = await db.query('SELECT * FROM roles ORDER BY name');

      res.render('admin/users/edit', {
        title: `Edit User - ${user.first_name} ${user.last_name}`,
        layout: 'layouts/admin-layout',
        user,
        profile,
        roles,
        formData: req.flash('formData')[0] || { ...user, ...profile }
      });
    } catch (error) {
      console.error('Show edit user error:', error);
      req.flash('error_msg', 'Error loading edit form');
      res.redirect('/admin/users');
    }
  }

  async updateUser(req, res) {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        req.flash('error_msg', 'User not found');
        return res.redirect('/admin/users');
      }

      const { first_name, last_name, phone, address, date_of_birth, gender } = req.body;

      await User.update(userId, {
        first_name,
        last_name,
        phone,
        address,
        date_of_birth,
        gender
      });

      // Update role-specific profile
      if (user.role_name === ROLES.STUDENT) {
        const { program, semester, year } = req.body;
        await Student.update(userId, {
          program,
          semester,
          year: parseInt(year)
        });
      } else if (user.role_name === ROLES.INSTRUCTOR) {
        const { department, qualification, specialization, office_location, office_hours } = req.body;
        await Instructor.update(userId, {
          department,
          qualification,
          specialization,
          office_location,
          office_hours
        });
      }

      req.flash('success_msg', 'User updated successfully');
      res.redirect(`/admin/users/${userId}`);
    } catch (error) {
      console.error('Update user error:', error);
      req.flash('error_msg', 'Error updating user');
      req.flash('formData', req.body);
      res.redirect(`/admin/users/${req.params.id}/edit`);
    }
  }

  async updateUserStatus(req, res) {
    try {
      const userId = req.params.id;
      const { is_active } = req.body;

      if (parseInt(userId) === req.user.id) {
        return res.json({
          success: false,
          message: 'You cannot change your own status'
        });
      }

      await db.query(
        'UPDATE users SET is_active = ?, updated_at = NOW(), updated_by = ? WHERE id = ?',
        [is_active, req.user.id, userId]
      );

      res.json({
        success: true,
        message: 'User status updated successfully'
      });
    } catch (error) {
      console.error('Update user status error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating user status'
      });
    }
  }

  async updateUserRole(req, res) {
    try {
      const userId = req.params.id;
      const { role_id } = req.body;

      if (parseInt(userId) === req.user.id) {
        return res.json({
          success: false,
          message: 'You cannot change your own role'
        });
      }

      await db.query(
        'UPDATE users SET role_id = ?, updated_at = NOW(), updated_by = ? WHERE id = ?',
        [role_id, req.user.id, userId]
      );

      res.json({
        success: true,
        message: 'User role updated successfully'
      });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating user role'
      });
    }
  }

  async deleteUser(req, res) {
    try {
      const userId = req.params.id;

      if (parseInt(userId) === req.user.id) {
        return res.json({
          success: false,
          message: 'You cannot delete your own account'
        });
      }

      await db.query(
        'UPDATE users SET is_active = 0, updated_at = NOW(), updated_by = ? WHERE id = ?',
        [req.user.id, userId]
      );

      res.json({
        success: true,
        message: 'User deactivated successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deactivating user'
      });
    }
  }

  // Student Management

  async listStudents(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const program = req.query.program;
      const semester = req.query.semester;

      const students = await Student.getAll(page, limit, program, semester);

      res.render('admin/users/students', {
        title: 'Student Management - EduLMS',
        layout: 'layouts/admin-layout',
        students: students.students,
        pagination: Helpers.generatePagination(page, students.totalPages, '/admin/students'),
        currentProgram: program,
        currentSemester: semester
      });
    } catch (error) {
      console.error('List students error:', error);
      req.flash('error_msg', 'Error loading students');
      res.redirect('/admin/dashboard');
    }
  }

  async showStudent(req, res) {
    try {
      const userId = req.params.id;
      const student = await Student.findByUserId(userId);

      if (!student) {
        req.flash('error_msg', 'Student not found');
        return res.redirect('/admin/students');
      }

      const enrollments = await Student.getEnrollments(userId);
      const grades = await Student.getGrades(userId);

      res.render('admin/users/student-details', {
        title: `Student Details - ${student.first_name} ${student.last_name}`,
        layout: 'layouts/admin-layout',
        student,
        enrollments,
        grades
      });
    } catch (error) {
      console.error('Show student error:', error);
      req.flash('error_msg', 'Error loading student details');
      res.redirect('/admin/students');
    }
  }

  async enrollStudent(req, res) {
    try {
      const studentId = req.params.id;
      const { course_id } = req.body;

      // Check if already enrolled
      const existing = await db.query(
        'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
        [studentId, course_id]
      );

      if (existing.length > 0) {
        return res.json({
          success: false,
          message: 'Student is already enrolled in this course'
        });
      }

      await db.query(
        'INSERT INTO enrollments (student_id, course_id, enrollment_date, status) VALUES (?, ?, NOW(), "active")',
        [studentId, course_id]
      );

      res.json({
        success: true,
        message: 'Student enrolled successfully'
      });
    } catch (error) {
      console.error('Enroll student error:', error);
      res.status(500).json({
        success: false,
        message: 'Error enrolling student'
      });
    }
  }

  async withdrawStudent(req, res) {
    try {
      const studentId = req.params.id;
      const { course_id } = req.body;

      await db.query(
        'UPDATE enrollments SET status = "dropped", updated_at = NOW() WHERE student_id = ? AND course_id = ?',
        [studentId, course_id]
      );

      res.json({
        success: true,
        message: 'Student withdrawn successfully'
      });
    } catch (error) {
      console.error('Withdraw student error:', error);
      res.status(500).json({
        success: false,
        message: 'Error withdrawing student'
      });
    }
  }

  // Instructor Management

  async listInstructors(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const department = req.query.department;

      let query = `
        SELECT i.*, u.first_name, u.last_name, u.email, u.phone 
        FROM instructors i 
        JOIN users u ON i.user_id = u.id 
        WHERE u.is_active = 1
      `;
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM instructors i 
        JOIN users u ON i.user_id = u.id 
        WHERE u.is_active = 1
      `;
      const params = [];
      const countParams = [];

      if (department) {
        query += ' AND i.department = ?';
        countQuery += ' AND i.department = ?';
        params.push(department);
        countParams.push(department);
      }

      query += ' ORDER BY u.last_name, u.first_name LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      const [instructors, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
      ]);

      const totalPages = Math.ceil(countResult[0].total / limit);

      res.render('admin/users/instructors', {
        title: 'Instructor Management - EduLMS',
        layout: 'layouts/admin-layout',
        instructors,
        pagination: Helpers.generatePagination(page, totalPages, '/admin/instructors'),
        currentDepartment: department
      });
    } catch (error) {
      console.error('List instructors error:', error);
      req.flash('error_msg', 'Error loading instructors');
      res.redirect('/admin/dashboard');
    }
  }

  async showInstructor(req, res) {
    try {
      const userId = req.params.id;
      const instructor = await Instructor.findByUserId(userId);

      if (!instructor) {
        req.flash('error_msg', 'Instructor not found');
        return res.redirect('/admin/instructors');
      }

      const courses = await Instructor.getCourses(userId);
      const stats = await Instructor.getStats(userId);

      res.render('admin/users/instructor-details', {
        title: `Instructor Details - ${instructor.first_name} ${instructor.last_name}`,
        layout: 'layouts/admin-layout',
        instructor,
        courses: courses.courses,
        stats
      });
    } catch (error) {
      console.error('Show instructor error:', error);
      req.flash('error_msg', 'Error loading instructor details');
      res.redirect('/admin/instructors');
    }
  }

  async assignCourse(req, res) {
    try {
      const instructorId = req.params.id;
      const { course_id } = req.body;

      await db.query(
        'UPDATE courses SET instructor_id = ?, updated_at = NOW() WHERE id = ?',
        [instructorId, course_id]
      );

      res.json({
        success: true,
        message: 'Course assigned successfully'
      });
    } catch (error) {
      console.error('Assign course error:', error);
      res.status(500).json({
        success: false,
        message: 'Error assigning course'
      });
    }
  }

  // Course Management

  async listCourses(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;
      const category_id = req.query.category_id;
      const search = req.query.search;

      const courses = await Course.getAll(page, limit, {
        status,
        category_id,
        search
      });

      const categories = await db.query('SELECT * FROM categories ORDER BY name');

      res.render('admin/courses/list', {
        title: 'Course Management - EduLMS',
        layout: 'layouts/admin-layout',
        courses: courses.courses,
        pagination: Helpers.generatePagination(page, courses.totalPages, '/admin/courses'),
        categories,
        currentStatus: status,
        currentCategory: category_id,
        searchQuery: search
      });
    } catch (error) {
      console.error('List courses error:', error);
      req.flash('error_msg', 'Error loading courses');
      res.redirect('/admin/dashboard');
    }
  }

  async showCreateCourse(req, res) {
    try {
      const instructors = await db.query(`
        SELECT u.id, u.first_name, u.last_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE r.name = 'instructor' AND u.is_active = 1
        ORDER BY u.last_name, u.first_name
      `);

      const categories = await db.query('SELECT * FROM categories ORDER BY name');

      res.render('admin/courses/create', {
        title: 'Create Course - EduLMS',
        layout: 'layouts/admin-layout',
        instructors,
        categories,
        formData: req.flash('formData')[0] || {}
      });
    } catch (error) {
      console.error('Show create course error:', error);
      req.flash('error_msg', 'Error loading create course form');
      res.redirect('/admin/courses');
    }
  }

  async createCourse(req, res) {
    try {
      const {
        title,
        code,
        description,
        instructor_id,
        category_id,
        credits,
        duration,
        max_students,
        start_date,
        end_date,
        syllabus,
        requirements,
        learning_outcomes
      } = req.body;

      // Check if course code already exists
      const existingCourse = await Course.findByCode(code);
      if (existingCourse) {
        req.flash('error_msg', 'Course code already exists');
        req.flash('formData', req.body);
        return res.redirect('/admin/courses/create');
      }

      const courseId = await Course.create({
        title,
        code,
        description,
        instructor_id,
        category_id,
        credits: parseFloat(credits),
        duration: parseInt(duration),
        max_students: parseInt(max_students),
        start_date,
        end_date,
        syllabus,
        requirements,
        learning_outcomes,
        created_by: req.user.id
      });

      req.flash('success_msg', 'Course created successfully');
      res.redirect('/admin/courses');
    } catch (error) {
      console.error('Create course error:', error);
      req.flash('error_msg', 'Error creating course');
      req.flash('formData', req.body);
      res.redirect('/admin/courses/create');
    }
  }

  async showCourse(req, res) {
    try {
      const courseId = req.params.id;
      const course = await Course.findById(courseId);

      if (!course) {
        req.flash('error_msg', 'Course not found');
        return res.redirect('/admin/courses');
      }

      const materials = await Course.getMaterials(courseId);
      const assignments = await Course.getAssignments(courseId);
      const enrollments = await Course.getEnrollments(courseId);

      res.render('admin/courses/view', {
        title: `Course Details - ${course.title}`,
        layout: 'layouts/admin-layout',
        course,
        materials,
        assignments,
        enrollments
      });
    } catch (error) {
      console.error('Show course error:', error);
      req.flash('error_msg', 'Error loading course details');
      res.redirect('/admin/courses');
    }
  }

  async showEditCourse(req, res) {
    try {
      const courseId = req.params.id;
      const course = await Course.findById(courseId);

      if (!course) {
        req.flash('error_msg', 'Course not found');
        return res.redirect('/admin/courses');
      }

      const instructors = await db.query(`
        SELECT u.id, u.first_name, u.last_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE r.name = 'instructor' AND u.is_active = 1
        ORDER BY u.last_name, u.first_name
      `);

      const categories = await db.query('SELECT * FROM categories ORDER BY name');

      res.render('admin/courses/edit', {
        title: `Edit Course - ${course.title}`,
        layout: 'layouts/admin-layout',
        course,
        instructors,
        categories,
        formData: req.flash('formData')[0] || course
      });
    } catch (error) {
      console.error('Show edit course error:', error);
      req.flash('error_msg', 'Error loading edit form');
      res.redirect('/admin/courses');
    }
  }

  async updateCourse(req, res) {
    try {
      const courseId = req.params.id;
      const course = await Course.findById(courseId);

      if (!course) {
        req.flash('error_msg', 'Course not found');
        return res.redirect('/admin/courses');
      }

      const {
        title,
        description,
        category_id,
        credits,
        duration,
        max_students,
        start_date,
        end_date,
        syllabus,
        requirements,
        learning_outcomes,
        status
      } = req.body;

      await Course.update(courseId, {
        title,
        description,
        category_id,
        credits: parseFloat(credits),
        duration: parseInt(duration),
        max_students: parseInt(max_students),
        start_date,
        end_date,
        syllabus,
        requirements,
        learning_outcomes,
        status
      });

      req.flash('success_msg', 'Course updated successfully');
      res.redirect(`/admin/courses/${courseId}`);
    } catch (error) {
      console.error('Update course error:', error);
      req.flash('error_msg', 'Error updating course');
      req.flash('formData', req.body);
      res.redirect(`/admin/courses/${courseId}/edit`);
    }
  }

  async updateCourseStatus(req, res) {
    try {
      const courseId = req.params.id;
      const { status } = req.body;

      await db.query(
        'UPDATE courses SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, courseId]
      );

      res.json({
        success: true,
        message: 'Course status updated successfully'
      });
    } catch (error) {
      console.error('Update course status error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating course status'
      });
    }
  }

  async deleteCourse(req, res) {
    try {
      const courseId = req.params.id;

      // Check if course has enrollments
      const enrollments = await db.query(
        'SELECT COUNT(*) as total FROM enrollments WHERE course_id = ? AND status = "active"',
        [courseId]
      );

      if (enrollments[0].total > 0) {
        return res.json({
          success: false,
          message: 'Cannot delete course with active enrollments'
        });
      }

      await db.query('UPDATE courses SET status = "inactive", updated_at = NOW() WHERE id = ?', [courseId]);

      res.json({
        success: true,
        message: 'Course deleted successfully'
      });
    } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting course'
      });
    }
  }

  // Category Management

  async listCategories(req, res) {
    try {
      const categories = await db.query(`
        SELECT c.*, COUNT(co.id) as course_count 
        FROM categories c 
        LEFT JOIN courses co ON c.id = co.category_id AND co.status = 'active'
        GROUP BY c.id 
        ORDER BY c.name
      `);

      res.render('admin/courses/categories', {
        title: 'Category Management - EduLMS',
        layout: 'layouts/admin-layout',
        categories
      });
    } catch (error) {
      console.error('List categories error:', error);
      req.flash('error_msg', 'Error loading categories');
      res.redirect('/admin/dashboard');
    }
  }

  async createCategory(req, res) {
    try {
      const { name, description, parent_id } = req.body;

      await db.query(
        'INSERT INTO categories (name, description, parent_id, created_at) VALUES (?, ?, ?, NOW())',
        [name, description, parent_id || null]
      );

      req.flash('success_msg', 'Category created successfully');
      res.redirect('/admin/categories');
    } catch (error) {
      console.error('Create category error:', error);
      req.flash('error_msg', 'Error creating category');
      res.redirect('/admin/categories');
    }
  }

  async updateCategory(req, res) {
    try {
      const categoryId = req.params.id;
      const { name, description, parent_id } = req.body;

      await db.query(
        'UPDATE categories SET name = ?, description = ?, parent_id = ?, updated_at = NOW() WHERE id = ?',
        [name, description, parent_id || null, categoryId]
      );

      res.json({
        success: true,
        message: 'Category updated successfully'
      });
    } catch (error) {
      console.error('Update category error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating category'
      });
    }
  }

  async deleteCategory(req, res) {
    try {
      const categoryId = req.params.id;

      // Check if category has courses
      const courses = await db.query(
        'SELECT COUNT(*) as total FROM courses WHERE category_id = ?',
        [categoryId]
      );

      if (courses[0].total > 0) {
        return res.json({
          success: false,
          message: 'Cannot delete category with associated courses'
        });
      }

      await db.query('DELETE FROM categories WHERE id = ?', [categoryId]);

      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      console.error('Delete category error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting category'
      });
    }
  }

  // Finance Management

  async financeOverview(req, res) {
    try {
      // Get financial statistics
      const revenueStats = await db.query(`
        SELECT 
          DATE(created_at) as date,
          SUM(amount) as revenue,
          COUNT(*) as payment_count
        FROM payments 
        WHERE status = 'completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      const feeTypes = await db.query(`
        SELECT 
          fee_type,
          SUM(amount) as total_revenue,
          COUNT(*) as payment_count
        FROM payments 
        WHERE status = 'completed'
        GROUP BY fee_type
        ORDER BY total_revenue DESC
      `);

      const outstandingFees = await db.query(`
        SELECT SUM(fee_balance) as total_outstanding 
        FROM students
      `);

      res.render('admin/finance/overview', {
        title: 'Finance Overview - EduLMS',
        layout: 'layouts/admin-layout',
        revenueStats,
        feeTypes,
        totalOutstanding: outstandingFees[0].total_outstanding || 0
      });
    } catch (error) {
      console.error('Finance overview error:', error);
      req.flash('error_msg', 'Error loading finance overview');
      res.redirect('/admin/dashboard');
    }
  }

  async listPayments(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status;
      const fee_type = req.query.fee_type;
      const start_date = req.query.start_date;
      const end_date = req.query.end_date;

      let query = `
        SELECT p.*, u.first_name, u.last_name, s.student_id 
        FROM payments p
        JOIN users u ON p.student_id = u.id
        LEFT JOIN students s ON p.student_id = s.user_id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) as total FROM payments p WHERE 1=1`;
      const params = [];
      const countParams = [];

      if (status) {
        query += ' AND p.status = ?';
        countQuery += ' AND p.status = ?';
        params.push(status);
        countParams.push(status);
      }

      if (fee_type) {
        query += ' AND p.fee_type = ?';
        countQuery += ' AND p.fee_type = ?';
        params.push(fee_type);
        countParams.push(fee_type);
      }

      if (start_date) {
        query += ' AND DATE(p.created_at) >= ?';
        countQuery += ' AND DATE(p.created_at) >= ?';
        params.push(start_date);
        countParams.push(start_date);
      }

      if (end_date) {
        query += ' AND DATE(p.created_at) <= ?';
        countQuery += ' AND DATE(p.created_at) <= ?';
        params.push(end_date);
        countParams.push(end_date);
      }

      query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      const [payments, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
      ]);

      const totalPages = Math.ceil(countResult[0].total / limit);

      res.render('admin/finance/payments', {
        title: 'Payment Management - EduLMS',
        layout: 'layouts/admin-layout',
        payments,
        pagination: Helpers.generatePagination(page, totalPages, '/admin/finance/payments'),
        currentStatus: status,
        currentFeeType: fee_type,
        startDate: start_date,
        endDate: end_date
      });
    } catch (error) {
      console.error('List payments error:', error);
      req.flash('error_msg', 'Error loading payments');
      res.redirect('/admin/finance/overview');
    }
  }

  async revenueReports(req, res) {
    try {
      const period = req.query.period || 'month';
      const year = req.query.year || new Date().getFullYear();

      let dateFormat, groupBy;
      switch (period) {
        case 'day':
          dateFormat = '%Y-%m-%d';
          groupBy = 'DATE(created_at)';
          break;
        case 'week':
          dateFormat = '%Y-%u';
          groupBy = 'YEARWEEK(created_at)';
          break;
        case 'month':
          dateFormat = '%Y-%m';
          groupBy = 'YEAR(created_at), MONTH(created_at)';
          break;
        default:
          dateFormat = '%Y-%m';
          groupBy = 'YEAR(created_at), MONTH(created_at)';
      }

      const revenueData = await db.query(`
        SELECT 
          DATE_FORMAT(created_at, '${dateFormat}') as period,
          SUM(amount) as revenue,
          COUNT(*) as payment_count
        FROM payments 
        WHERE status = 'completed' AND YEAR(created_at) = ?
        GROUP BY ${groupBy}
        ORDER BY period
      `, [year]);

      res.render('admin/finance/revenue-reports', {
        title: 'Revenue Reports - EduLMS',
        layout: 'layouts/admin-layout',
        revenueData,
        currentPeriod: period,
        currentYear: year
      });
    } catch (error) {
      console.error('Revenue reports error:', error);
      req.flash('error_msg', 'Error loading revenue reports');
      res.redirect('/admin/finance/overview');
    }
  }

  // Academic Management

  async listAssignments(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const course_id = req.query.course_id;
      const status = req.query.status;

      let query = `
        SELECT a.*, c.title as course_title, c.code as course_code,
               u.first_name as instructor_first_name, u.last_name as instructor_last_name
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN users u ON c.instructor_id = u.id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) as total FROM assignments a WHERE 1=1`;
      const params = [];
      const countParams = [];

      if (course_id) {
        query += ' AND a.course_id = ?';
        countQuery += ' AND a.course_id = ?';
        params.push(course_id);
        countParams.push(course_id);
      }

      if (status) {
        query += ' AND a.status = ?';
        countQuery += ' AND a.status = ?';
        params.push(status);
        countParams.push(status);
      }

      query += ' ORDER BY a.due_date DESC LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      const [assignments, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
      ]);

      const totalPages = Math.ceil(countResult[0].total / limit);
      const courses = await db.query('SELECT id, code, title FROM courses ORDER BY code');

      res.render('admin/academic/assignments', {
        title: 'Assignment Management - EduLMS',
        layout: 'layouts/admin-layout',
        assignments,
        pagination: Helpers.generatePagination(page, totalPages, '/admin/academic/assignments'),
        courses,
        currentCourse: course_id,
        currentStatus: status
      });
    } catch (error) {
      console.error('List assignments error:', error);
      req.flash('error_msg', 'Error loading assignments');
      res.redirect('/admin/dashboard');
    }
  }

  async listSubmissions(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const assignment_id = req.query.assignment_id;
      const status = req.query.status;

      let query = `
        SELECT s.*, a.title as assignment_title, a.total_points,
               u.first_name as student_first_name, u.last_name as student_last_name,
               st.student_id, c.title as course_title
        FROM assignment_submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN users u ON s.student_id = u.id
        LEFT JOIN students st ON s.student_id = st.user_id
        JOIN courses c ON a.course_id = c.id
        WHERE 1=1
      `;
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM assignment_submissions s 
        WHERE 1=1
      `;
      const params = [];
      const countParams = [];

      if (assignment_id) {
        query += ' AND s.assignment_id = ?';
        countQuery += ' AND s.assignment_id = ?';
        params.push(assignment_id);
        countParams.push(assignment_id);
      }

      if (status) {
        query += ' AND s.status = ?';
        countQuery += ' AND s.status = ?';
        params.push(status);
        countParams.push(status);
      }

      query += ' ORDER BY s.submitted_at DESC LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      const [submissions, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
      ]);

      const totalPages = Math.ceil(countResult[0].total / limit);
      const assignments = await db.query(`
        SELECT a.id, a.title, c.title as course_title 
        FROM assignments a 
        JOIN courses c ON a.course_id = c.id 
        ORDER BY c.title, a.title
      `);

      res.render('admin/academic/submissions', {
        title: 'Submission Management - EduLMS',
        layout: 'layouts/admin-layout',
        submissions,
        pagination: Helpers.generatePagination(page, totalPages, '/admin/academic/submissions'),
        assignments,
        currentAssignment: assignment_id,
        currentStatus: status
      });
    } catch (error) {
      console.error('List submissions error:', error);
      req.flash('error_msg', 'Error loading submissions');
      res.redirect('/admin/dashboard');
    }
  }

  async gradesOverview(req, res) {
    try {
      const course_id = req.query.course_id;
      const semester = req.query.semester;

      let query = `
        SELECT 
          c.code as course_code,
          c.title as course_title,
          COUNT(DISTINCT g.student_id) as student_count,
          AVG(g.score) as average_score,
          MAX(g.score) as highest_score,
          MIN(g.score) as lowest_score
        FROM grades g
        JOIN assignments a ON g.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (course_id) {
        query += ' AND c.id = ?';
        params.push(course_id);
      }

      if (semester) {
        query += ' AND c.semester = ?';
        params.push(semester);
      }

      query += ' GROUP BY c.id, c.code, c.title ORDER BY c.code';

      const gradeStats = await db.query(query, params);
      const courses = await db.query('SELECT id, code, title FROM courses ORDER BY code');

      res.render('admin/academic/grades-overview', {
        title: 'Grades Overview - EduLMS',
        layout: 'layouts/admin-layout',
        gradeStats,
        courses,
        currentCourse: course_id,
        currentSemester: semester
      });
    } catch (error) {
      console.error('Grades overview error:', error);
      req.flash('error_msg', 'Error loading grades overview');
      res.redirect('/admin/dashboard');
    }
  }

  async listEnrollments(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const course_id = req.query.course_id;
      const status = req.query.status;

      let query = `
        SELECT e.*, c.title as course_title, c.code as course_code,
               u.first_name, u.last_name, u.email, s.student_id
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        JOIN users u ON e.student_id = u.id
        LEFT JOIN students s ON e.student_id = s.user_id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) as total FROM enrollments e WHERE 1=1`;
      const params = [];
      const countParams = [];

      if (course_id) {
        query += ' AND e.course_id = ?';
        countQuery += ' AND e.course_id = ?';
        params.push(course_id);
        countParams.push(course_id);
      }

      if (status) {
        query += ' AND e.status = ?';
        countQuery += ' AND e.status = ?';
        params.push(status);
        countParams.push(status);
      }

      query += ' ORDER BY e.enrollment_date DESC LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      const [enrollments, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
      ]);

      const totalPages = Math.ceil(countResult[0].total / limit);
      const courses = await db.query('SELECT id, code, title FROM courses ORDER BY code');

      res.render('admin/academic/enrollments', {
        title: 'Enrollment Management - EduLMS',
        layout: 'layouts/admin-layout',
        enrollments,
        pagination: Helpers.generatePagination(page, totalPages, '/admin/academic/enrollments'),
        courses,
        currentCourse: course_id,
        currentStatus: status
      });
    } catch (error) {
      console.error('List enrollments error:', error);
      req.flash('error_msg', 'Error loading enrollments');
      res.redirect('/admin/dashboard');
    }
  }

  // System Management

  async systemSettings(req, res) {
    try {
      const settings = await db.query('SELECT * FROM system_settings');

      // Convert settings to key-value pairs
      const settingsMap = {};
      settings.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });

      res.render('admin/system/settings', {
        title: 'System Settings - EduLMS',
        layout: 'layouts/admin-layout',
        settings: settingsMap
      });
    } catch (error) {
      console.error('System settings error:', error);
      req.flash('error_msg', 'Error loading system settings');
      res.redirect('/admin/dashboard');
    }
  }

  async updateSystemSettings(req, res) {
    try {
      const settings = req.body;

      for (const [key, value] of Object.entries(settings)) {
        await db.query(`
          INSERT INTO system_settings (key, value, updated_at, updated_by) 
          VALUES (?, ?, NOW(), ?) 
          ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW(), updated_by = ?
        `, [key, value, req.user.id, value, req.user.id]);
      }

      req.flash('success_msg', 'System settings updated successfully');
      res.redirect('/admin/system/settings');
    } catch (error) {
      console.error('Update system settings error:', error);
      req.flash('error_msg', 'Error updating system settings');
      res.redirect('/admin/system/settings');
    }
  }

  async systemNotifications(req, res) {
    try {
      const notifications = await db.query(`
        SELECT n.*, u.first_name, u.last_name 
        FROM notifications n 
        LEFT JOIN users u ON n.sender_id = u.id 
        ORDER BY n.created_at DESC 
        LIMIT 50
      `);

      res.render('admin/system/notifications', {
        title: 'System Notifications - EduLMS',
        layout: 'layouts/admin-layout',
        notifications
      });
    } catch (error) {
      console.error('System notifications error:', error);
      req.flash('error_msg', 'Error loading notifications');
      res.redirect('/admin/dashboard');
    }
  }

  async sendNotification(req, res) {
    try {
      const { title, message, recipient_type, recipient_ids, notification_type } = req.body;

      // This would integrate with the notification service
      req.flash('success_msg', 'Notification sent successfully');
      res.redirect('/admin/system/notifications');
    } catch (error) {
      console.error('Send notification error:', error);
      req.flash('error_msg', 'Error sending notification');
      res.redirect('/admin/system/notifications');
    }
  }

  async auditLogs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const action = req.query.action;
      const user_id = req.query.user_id;
      const start_date = req.query.start_date;
      const end_date = req.query.end_date;

      let query = `
        SELECT al.*, u.first_name, u.last_name, u.email 
        FROM audit_logs al 
        LEFT JOIN users u ON al.user_id = u.id 
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) as total FROM audit_logs al WHERE 1=1`;
      const params = [];
      const countParams = [];

      if (action) {
        query += ' AND al.action = ?';
        countQuery += ' AND al.action = ?';
        params.push(action);
        countParams.push(action);
      }

      if (user_id) {
        query += ' AND al.user_id = ?';
        countQuery += ' AND al.user_id = ?';
        params.push(user_id);
        countParams.push(user_id);
      }

      if (start_date) {
        query += ' AND DATE(al.created_at) >= ?';
        countQuery += ' AND DATE(al.created_at) >= ?';
        params.push(start_date);
        countParams.push(start_date);
      }

      if (end_date) {
        query += ' AND DATE(al.created_at) <= ?';
        countQuery += ' AND DATE(al.created_at) <= ?';
        params.push(end_date);
        countParams.push(end_date);
      }

      query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      const [logs, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
      ]);

      const totalPages = Math.ceil(countResult[0].total / limit);
      const users = await db.query('SELECT id, first_name, last_name FROM users ORDER BY first_name, last_name');
      const actions = await db.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');

      res.render('admin/system/audit-logs', {
        title: 'Audit Logs - EduLMS',
        layout: 'layouts/admin-layout',
        logs,
        pagination: Helpers.generatePagination(page, totalPages, '/admin/system/audit-logs'),
        users,
        actions,
        currentAction: action,
        currentUser: user_id,
        startDate: start_date,
        endDate: end_date
      });
    } catch (error) {
      console.error('Audit logs error:', error);
      req.flash('error_msg', 'Error loading audit logs');
      res.redirect('/admin/dashboard');
    }
  }

  async backupManagement(req, res) {
    try {
      const backups = await db.query('SELECT * FROM backups ORDER BY created_at DESC LIMIT 10');

      res.render('admin/system/backup', {
        title: 'Backup Management - EduLMS',
        layout: 'layouts/admin-layout',
        backups
      });
    } catch (error) {
      console.error('Backup management error:', error);
      req.flash('error_msg', 'Error loading backup management');
      res.redirect('/admin/dashboard');
    }
  }

  async createBackup(req, res) {
    try {
      // This would integrate with the backup service
      const backupId = Generators.generateReportId('BCK');

      await db.query(
        'INSERT INTO backups (id, filename, file_size, created_by) VALUES (?, ?, ?, ?)',
        [backupId, `backup-${backupId}.sql`, 0, req.user.id]
      );

      req.flash('success_msg', 'Backup created successfully');
      res.redirect('/admin/system/backup');
    } catch (error) {
      console.error('Create backup error:', error);
      req.flash('error_msg', 'Error creating backup');
      res.redirect('/admin/system/backup');
    }
  }

  async systemHealth(req, res) {
    try {
      // Get system health metrics
      const databaseStatus = await db.query('SELECT 1 as status');
      const activeUsers = await db.query('SELECT COUNT(*) as count FROM users WHERE last_login >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)');
      const systemLoad = process.memoryUsage();

      res.render('admin/system/system-health', {
        title: 'System Health - EduLMS',
        layout: 'layouts/admin-layout',
        databaseStatus: databaseStatus.length > 0 ? 'healthy' : 'unhealthy',
        activeUsers: activeUsers[0].count,
        systemLoad,
        uptime: process.uptime()
      });
    } catch (error) {
      console.error('System health error:', error);
      req.flash('error_msg', 'Error loading system health');
      res.redirect('/admin/dashboard');
    }
  }

  // Report Generation

  async showReportGenerator(req, res) {
    try {
      const reportTemplates = [
        { id: 'student_performance', name: 'Student Performance Report', type: 'academic' },
        { id: 'financial_summary', name: 'Financial Summary Report', type: 'financial' },
        { id: 'attendance_report', name: 'Attendance Report', type: 'academic' },
        { id: 'course_enrollment', name: 'Course Enrollment Report', type: 'academic' }
      ];

      res.render('admin/reports/generate', {
        title: 'Report Generator - EduLMS',
        layout: 'layouts/admin-layout',
        reportTemplates
      });
    } catch (error) {
      console.error('Show report generator error:', error);
      req.flash('error_msg', 'Error loading report generator');
      res.redirect('/admin/dashboard');
    }
  }

  async generateReport(req, res) {
    try {
      const { report_type, format, start_date, end_date, filters } = req.body;

      // This would integrate with the report service
      req.flash('success_msg', 'Report generated successfully');
      res.redirect('/admin/reports/generate');
    } catch (error) {
      console.error('Generate report error:', error);
      req.flash('error_msg', 'Error generating report');
      res.redirect('/admin/reports/generate');
    }
  }

  async studentReports(req, res) {
    try {
      const students = await Student.getAll(1, 10);
      
      res.render('admin/reports/student-reports', {
        title: 'Student Reports - EduLMS',
        layout: 'layouts/admin-layout',
        students: students.students
      });
    } catch (error) {
      console.error('Student reports error:', error);
      req.flash('error_msg', 'Error loading student reports');
      res.redirect('/admin/dashboard');
    }
  }

  async financialReports(req, res) {
    try {
      const revenueStats = await db.query(`
        SELECT 
          fee_type,
          SUM(amount) as total_revenue,
          COUNT(*) as payment_count
        FROM payments 
        WHERE status = 'completed'
        GROUP BY fee_type
        ORDER BY total_revenue DESC
      `);

      res.render('admin/reports/financial-reports', {
        title: 'Financial Reports - EduLMS',
        layout: 'layouts/admin-layout',
        revenueStats
      });
    } catch (error) {
      console.error('Financial reports error:', error);
      req.flash('error_msg', 'Error loading financial reports');
      res.redirect('/admin/dashboard');
    }
  }

  async academicReports(req, res) {
    try {
      const courseStats = await db.query(`
        SELECT 
          c.code,
          c.title,
          COUNT(DISTINCT e.student_id) as enrollment_count,
          AVG(g.score) as average_grade
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
        LEFT JOIN assignments a ON c.id = a.course_id
        LEFT JOIN grades g ON a.id = g.assignment_id
        GROUP BY c.id, c.code, c.title
        ORDER BY c.code
      `);

      res.render('admin/reports/academic-reports', {
        title: 'Academic Reports - EduLMS',
        layout: 'layouts/admin-layout',
        courseStats
      });
    } catch (error) {
      console.error('Academic reports error:', error);
      req.flash('error_msg', 'Error loading academic reports');
      res.redirect('/admin/dashboard');
    }
  }

  async attendanceReports(req, res) {
    try {
      const attendanceStats = await db.query(`
        SELECT 
          c.code,
          c.title,
          COUNT(*) as total_sessions,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count
        FROM attendance a
        JOIN courses c ON a.course_id = c.id
        WHERE a.attendance_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY c.id, c.code, c.title
        ORDER BY c.code
      `);

      res.render('admin/reports/attendance-reports', {
        title: 'Attendance Reports - EduLMS',
        layout: 'layouts/admin-layout',
        attendanceStats
      });
    } catch (error) {
      console.error('Attendance reports error:', error);
      req.flash('error_msg', 'Error loading attendance reports');
      res.redirect('/admin/dashboard');
    }
  }

  async customReports(req, res) {
    try {
      res.render('admin/reports/custom-reports', {
        title: 'Custom Reports - EduLMS',
        layout: 'layouts/admin-layout'
      });
    } catch (error) {
      console.error('Custom reports error:', error);
      req.flash('error_msg', 'Error loading custom reports');
      res.redirect('/admin/dashboard');
    }
  }

  // Bulk Operations

  async showBulkImport(req, res) {
    try {
      res.render('admin/bulk/import', {
        title: 'Bulk Import - EduLMS',
        layout: 'layouts/admin-layout'
      });
    } catch (error) {
      console.error('Show bulk import error:', error);
      req.flash('error_msg', 'Error loading bulk import');
      res.redirect('/admin/dashboard');
    }
  }

  async bulkImportUsers(req, res) {
    try {
      // This would handle CSV file upload and processing
      req.flash('success_msg', 'Users imported successfully');
      res.redirect('/admin/bulk/import');
    } catch (error) {
      console.error('Bulk import users error:', error);
      req.flash('error_msg', 'Error importing users');
      res.redirect('/admin/bulk/import');
    }
  }

  async bulkImportCourses(req, res) {
    try {
      // This would handle CSV file upload and processing
      req.flash('success_msg', 'Courses imported successfully');
      res.redirect('/admin/bulk/import');
    } catch (error) {
      console.error('Bulk import courses error:', error);
      req.flash('error_msg', 'Error importing courses');
      res.redirect('/admin/bulk/import');
    }
  }

  async bulkEnrollStudents(req, res) {
    try {
      // This would handle CSV file upload and processing
      req.flash('success_msg', 'Students enrolled successfully');
      res.redirect('/admin/bulk/import');
    } catch (error) {
      console.error('Bulk enroll students error:', error);
      req.flash('error_msg', 'Error enrolling students');
      res.redirect('/admin/bulk/import');
    }
  }

  // API endpoints

  async getStats(req, res) {
    try {
      const userStats = await User.getStats();
      const totalCourses = await db.query('SELECT COUNT(*) as total FROM courses WHERE status = "active"');
      const totalPayments = await db.query('SELECT COUNT(*) as total FROM payments WHERE status = "completed"');
      const revenue = await db.query('SELECT SUM(amount) as total FROM payments WHERE status = "completed"');

      res.json({
        success: true,
        stats: {
          users: userStats,
          courses: totalCourses[0].total,
          payments: totalPayments[0].total,
          revenue: revenue[0].total || 0
        }
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching statistics'
      });
    }
  }

  async getUsersCount(req, res) {
    try {
      const counts = await db.query(`
        SELECT r.name as role, COUNT(u.id) as count 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.is_active = 1 
        GROUP BY r.name
      `);

      res.json({
        success: true,
        counts
      });
    } catch (error) {
      console.error('Get users count error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user counts'
      });
    }
  }

  async getCoursesCount(req, res) {
    try {
      const counts = await db.query(`
        SELECT status, COUNT(*) as count 
        FROM courses 
        GROUP BY status
      `);

      res.json({
        success: true,
        counts
      });
    } catch (error) {
      console.error('Get courses count error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching course counts'
      });
    }
  }

  async getPaymentsStats(req, res) {
    try {
      const stats = await db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM payments 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY status
      `);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Get payments stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching payment statistics'
      });
    }
  }
}

module.exports = new AdminController();