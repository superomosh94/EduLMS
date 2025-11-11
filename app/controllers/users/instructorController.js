const db = require('../../../config/database');
const Instructor = require('../../models/Instructor');
const Course = require('../../models/Course');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');

const instructorController = {
  // Instructor dashboard
  dashboard: async (req, res) => {
    try {
      const instructorId = req.user.id;
      
      const [profile, courses, assignmentsForGrading, recentSubmissions] = await Promise.all([
        Instructor.getProfile(instructorId),
        Instructor.getCourses(instructorId, {}, 1, 5),
        Instructor.getAssignmentsForGrading(instructorId, 1, 5),
        db.query(`
          SELECT s.*, a.title as assignment_title, u.name as student_name, u.student_id
          FROM submissions s
          JOIN assignments a ON s.assignment_id = a.id
          JOIN courses c ON a.course_id = c.id
          JOIN users u ON s.student_id = u.id
          WHERE c.teacher_id = ?
          ORDER BY s.submitted_at DESC
          LIMIT 5
        `, [instructorId])
      ]);

      // Get announcements for instructors
      const announcements = await db.query(`
        SELECT * FROM announcements 
        WHERE is_active = 1 AND JSON_CONTAINS(target_roles, '"instructor"')
        ORDER BY created_at DESC 
        LIMIT 5
      `);

      res.render('instructor/dashboard', {
        title: 'Instructor Dashboard - EduLMS',
        layout: 'layouts/instructor-layout',
        profile,
        courses: courses.courses,
        assignmentsForGrading: assignmentsForGrading.assignments,
        recentSubmissions,
        announcements,
        currentPage: 'dashboard'
      });
    } catch (error) {
      console.error('Instructor dashboard error:', error);
      req.flash('error_msg', 'Error loading dashboard');
      res.render('instructor/dashboard', {
        title: 'Instructor Dashboard - EduLMS',
        layout: 'layouts/instructor-layout',
        profile: {},
        courses: [],
        assignmentsForGrading: [],
        recentSubmissions: [],
        announcements: [],
        currentPage: 'dashboard'
      });
    }
  },

  // View instructor courses
  courses: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || '';
      const semester = req.query.semester || '';
      const academic_year = req.query.academic_year || '';

      const filters = {};
      if (status) filters.status = status;
      if (semester) filters.semester = semester;
      if (academic_year) filters.academic_year = academic_year;

      const coursesData = await Instructor.getCourses(instructorId, filters, page, limit);

      res.render('instructor/courses/list', {
        title: 'My Courses - EduLMS',
        layout: 'layouts/instructor-layout',
        courses: coursesData.courses,
        pagination: {
          current: page,
          pages: coursesData.totalPages,
          total: coursesData.total
        },
        filters,
        currentPage: 'courses'
      });
    } catch (error) {
      console.error('Instructor courses error:', error);
      req.flash('error_msg', 'Error loading courses');
      res.render('instructor/courses/list', {
        title: 'My Courses - EduLMS',
        layout: 'layouts/instructor-layout',
        courses: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: {},
        currentPage: 'courses'
      });
    }
  },

  // View course details
  viewCourse: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const courseId = req.params.id;

      const course = await Course.findById(courseId);
      
      if (!course || course.teacher_id !== instructorId) {
        req.flash('error_msg', 'Course not found or access denied');
        return res.redirect('/instructor/courses');
      }

      const [students, assignments, courseStats] = await Promise.all([
        Instructor.getCourseStudents(courseId, instructorId),
        Course.getAssignments(courseId),
        db.query(`
          SELECT 
            COUNT(DISTINCT e.id) as total_students,
            COUNT(DISTINCT a.id) as total_assignments,
            COUNT(DISTINCT s.id) as total_submissions,
            AVG(g.grade_points) as average_grade
          FROM courses c
          LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
          LEFT JOIN assignments a ON c.id = a.course_id
          LEFT JOIN submissions s ON a.id = s.assignment_id
          LEFT JOIN grades g ON s.id = g.submission_id
          WHERE c.id = ?
        `, [courseId])
      ]);

      res.render('instructor/courses/view', {
        title: `${course.course_code} - ${course.title}`,
        layout: 'layouts/instructor-layout',
        course,
        students: students.students,
        assignments,
        courseStats: courseStats[0] || {},
        currentPage: 'courses'
      });
    } catch (error) {
      console.error('View course error:', error);
      req.flash('error_msg', 'Error loading course');
      res.redirect('/instructor/courses');
    }
  },

  // Show create course form
  showCreateCourse: (req, res) => {
    res.render('instructor/courses/create', {
      title: 'Create Course - EduLMS',
      layout: 'layouts/instructor-layout',
      currentPage: 'courses',
      semesters: ['spring', 'summer', 'fall', 'winter'],
      currentYear: new Date().getFullYear()
    });
  },

  // Create new course
  createCourse: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const {
        course_code,
        title,
        description,
        credits,
        department,
        semester,
        academic_year,
        max_students,
        fee_amount,
        start_date,
        end_date
      } = req.body;

      const courseData = {
        course_code,
        title,
        description: description || null,
        credits: parseInt(credits) || 3,
        teacher_id: instructorId,
        department: department || null,
        semester: semester || 'fall',
        academic_year: parseInt(academic_year) || new Date().getFullYear(),
        max_students: parseInt(max_students) || 30,
        fee_amount: parseFloat(fee_amount) || 0.00,
        start_date: start_date || null,
        end_date: end_date || null
      };

      const courseId = await Course.create(courseData);

      // Log course creation
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, details) 
         VALUES (?, 'course_create', 'courses', ?, ?)`,
        [instructorId, courseId, JSON.stringify(courseData)]
      );

      req.flash('success_msg', 'Course created successfully');
      res.redirect('/instructor/courses');

    } catch (error) {
      console.error('Create course error:', error);
      req.flash('error_msg', error.message || 'Error creating course');
      res.redirect('/instructor/courses/create');
    }
  },

  // Show edit course form
  showEditCourse: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const courseId = req.params.id;

      const course = await Course.findById(courseId);
      
      if (!course || course.teacher_id !== instructorId) {
        req.flash('error_msg', 'Course not found or access denied');
        return res.redirect('/instructor/courses');
      }

      res.render('instructor/courses/edit', {
        title: 'Edit Course - EduLMS',
        layout: 'layouts/instructor-layout',
        course,
        currentPage: 'courses',
        semesters: ['spring', 'summer', 'fall', 'winter']
      });
    } catch (error) {
      console.error('Show edit course error:', error);
      req.flash('error_msg', 'Error loading course');
      res.redirect('/instructor/courses');
    }
  },

  // Update course
  updateCourse: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const courseId = req.params.id;

      // Verify ownership
      const course = await Course.findById(courseId);
      if (!course || course.teacher_id !== instructorId) {
        req.flash('error_msg', 'Course not found or access denied');
        return res.redirect('/instructor/courses');
      }

      const {
        title,
        description,
        credits,
        department,
        semester,
        academic_year,
        max_students,
        fee_amount,
        start_date,
        end_date,
        status
      } = req.body;

      const updateData = {
        title,
        description: description || null,
        credits: parseInt(credits) || 3,
        department: department || null,
        semester: semester || 'fall',
        academic_year: parseInt(academic_year) || new Date().getFullYear(),
        max_students: parseInt(max_students) || 30,
        fee_amount: parseFloat(fee_amount) || 0.00,
        start_date: start_date || null,
        end_date: end_date || null,
        status: status || 'active'
      };

      await Course.update(courseId, updateData);

      // Log course update
      await db.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, details) 
         VALUES (?, 'course_update', 'courses', ?, ?)`,
        [instructorId, courseId, JSON.stringify(updateData)]
      );

      req.flash('success_msg', 'Course updated successfully');
      res.redirect('/instructor/courses');

    } catch (error) {
      console.error('Update course error:', error);
      req.flash('error_msg', error.message || 'Error updating course');
      res.redirect(`/instructor/courses/edit/${courseId}`);
    }
  },

  // Manage course students
  manageCourseStudents: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const courseId = req.params.id;

      const students = await Instructor.getCourseStudents(courseId, instructorId);

      res.render('instructor/courses/students', {
        title: 'Course Students - EduLMS',
        layout: 'layouts/instructor-layout',
        course: students.course,
        students: students.students,
        currentPage: 'courses'
      });
    } catch (error) {
      console.error('Manage course students error:', error);
      req.flash('error_msg', 'Error loading students');
      res.redirect('/instructor/courses');
    }
  },

  // View assignments
  assignments: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || '';
      const course_id = req.query.course_id || '';

      const filters = {};
      if (status) filters.status = status;
      if (course_id) filters.course_id = course_id;

      const assignmentsData = await Assignment.findAll(filters, page, limit);

      // Get instructor's courses for filter
      const courses = await Instructor.getCourses(instructorId);

      res.render('instructor/assignments/list', {
        title: 'My Assignments - EduLMS',
        layout: 'layouts/instructor-layout',
        assignments: assignmentsData.assignments,
        pagination: {
          current: page,
          pages: assignmentsData.totalPages,
          total: assignmentsData.total
        },
        filters,
        courses: courses.courses,
        currentPage: 'assignments'
      });
    } catch (error) {
      console.error('Instructor assignments error:', error);
      req.flash('error_msg', 'Error loading assignments');
      res.render('instructor/assignments/list', {
        title: 'My Assignments - EduLMS',
        layout: 'layouts/instructor-layout',
        assignments: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: {},
        courses: [],
        currentPage: 'assignments'
      });
    }
  },

  // Show create assignment form
  showCreateAssignment: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const courses = await Instructor.getCourses(instructorId, { status: 'active' });

      res.render('instructor/assignments/create', {
        title: 'Create Assignment - EduLMS',
        layout: 'layouts/instructor-layout',
        courses: courses.courses,
        currentPage: 'assignments',
        submissionTypes: ['file', 'text', 'both']
      });
    } catch (error) {
      console.error('Show create assignment error:', error);
      req.flash('error_msg', 'Error loading assignment form');
      res.redirect('/instructor/assignments');
    }
  },

  // Create new assignment
  createAssignment: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const {
        course_id,
        title,
        description,
        instructions,
        max_points,
        due_date,
        allowed_extensions,
        max_file_size,
        submission_type
      } = req.body;

      // Verify course ownership
      const course = await Course.findById(course_id);
      if (!course || course.teacher_id !== instructorId) {
        req.flash('error_msg', 'Course not found or access denied');
        return res.redirect('/instructor/assignments/create');
      }

      const assignmentData = {
        course_id,
        teacher_id: instructorId,
        title,
        description: description || null,
        instructions: instructions || null,
        max_points: parseFloat(max_points) || 100.00,
        due_date,
        allowed_extensions: allowed_extensions || '.pdf,.doc,.docx,.txt',
        max_file_size: parseInt(max_file_size) || 10485760,
        submission_type: submission_type || 'file'
      };

      const assignmentId = await Instructor.createAssignment(assignmentData);

      req.flash('success_msg', 'Assignment created successfully');
      res.redirect('/instructor/assignments');

    } catch (error) {
      console.error('Create assignment error:', error);
      req.flash('error_msg', 'Error creating assignment');
      res.redirect('/instructor/assignments/create');
    }
  },

  // Publish assignment
  publishAssignment: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const assignmentId = req.params.id;

      const result = await Instructor.publishAssignment(assignmentId, instructorId);

      req.flash('success_msg', `Assignment published successfully. Notified ${result.notified_students} students.`);
      res.redirect('/instructor/assignments');

    } catch (error) {
      console.error('Publish assignment error:', error);
      req.flash('error_msg', error.message || 'Error publishing assignment');
      res.redirect('/instructor/assignments');
    }
  },

  // View assignment submissions
  viewSubmissions: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const assignmentId = req.params.id;

      const status = req.query.status || '';
      const timeliness = req.query.timeliness || '';

      const filters = {};
      if (status) filters.status = status;
      if (timeliness) filters.timeliness = timeliness;

      const submissionsData = await Instructor.getAssignmentSubmissions(assignmentId, instructorId, filters);

      res.render('instructor/assignments/submissions', {
        title: `Submissions - ${submissionsData.assignment.title}`,
        layout: 'layouts/instructor-layout',
        assignment: submissionsData.assignment,
        submissions: submissionsData.submissions,
        statistics: submissionsData.statistics,
        filters,
        currentPage: 'assignments'
      });
    } catch (error) {
      console.error('View submissions error:', error);
      req.flash('error_msg', error.message || 'Error loading submissions');
      res.redirect('/instructor/assignments');
    }
  },

  // Show grade submission form
  showGradeSubmission: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const submissionId = req.params.id;

      const submission = await Submission.findById(submissionId);
      
      if (!submission) {
        req.flash('error_msg', 'Submission not found');
        return res.redirect('/instructor/assignments');
      }

      // Verify ownership
      if (submission.teacher_id !== instructorId) {
        req.flash('error_msg', 'Access denied');
        return res.redirect('/instructor/assignments');
      }

      res.render('instructor/assignments/grade', {
        title: `Grade Submission - ${submission.assignment_title}`,
        layout: 'layouts/instructor-layout',
        submission,
        currentPage: 'assignments'
      });
    } catch (error) {
      console.error('Show grade submission error:', error);
      req.flash('error_msg', 'Error loading grading form');
      res.redirect('/instructor/assignments');
    }
  },

  // Grade submission
  gradeSubmission: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const submissionId = req.params.id;

      const { points_earned, grade, feedback } = req.body;

      const gradeData = {
        points_earned: parseFloat(points_earned),
        grade,
        feedback: feedback || null
      };

      const result = await Instructor.gradeSubmission(submissionId, instructorId, gradeData);

      req.flash('success_msg', `Submission graded successfully. Score: ${result.points_earned}/${result.max_points} (${result.percentage}%)`);
      res.redirect(`/instructor/assignments/${result.assignment_id}/submissions`);

    } catch (error) {
      console.error('Grade submission error:', error);
      req.flash('error_msg', error.message || 'Error grading submission');
      res.redirect(`/instructor/submissions/${submissionId}/grade`);
    }
  },

  // Generate course report
  generateCourseReport: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const courseId = req.params.id;

      const reportData = await Instructor.generateCourseReport(courseId, instructorId);

      // In a real application, you would generate a PDF here
      // For now, we'll just display the data

      res.render('instructor/grades/report', {
        title: `Course Report - ${reportData.course.course_code}`,
        layout: 'layouts/instructor-layout',
        reportData,
        currentPage: 'grades'
      });
    } catch (error) {
      console.error('Generate course report error:', error);
      req.flash('error_msg', error.message || 'Error generating report');
      res.redirect('/instructor/courses');
    }
  },

  // View instructor profile
  profile: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const profile = await Instructor.getProfile(instructorId);

      res.render('instructor/profile/view', {
        title: 'My Profile - EduLMS',
        layout: 'layouts/instructor-layout',
        profile,
        currentPage: 'profile'
      });
    } catch (error) {
      console.error('Instructor profile error:', error);
      req.flash('error_msg', 'Error loading profile');
      res.render('instructor/profile/view', {
        title: 'My Profile - EduLMS',
        layout: 'layouts/instructor-layout',
        profile: {},
        currentPage: 'profile'
      });
    }
  }
};

module.exports = instructorController;