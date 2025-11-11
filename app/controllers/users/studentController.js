const db = require('../../../config/database');
const Student = require('../../models/Student');
const Course = require('../../models/Course');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');

const studentController = {
  // Student dashboard
  dashboard: async (req, res) => {
    try {
      const studentId = req.user.id;
      
      const [profile, academicSummary, recentAssignments, upcomingDeadlines] = await Promise.all([
        Student.getProfile(studentId),
        Student.getAcademicSummary(studentId),
        Student.getAssignments(studentId, { status: 'submitted' }, 1, 5),
        Student.getAssignments(studentId, { status: 'pending' }, 1, 5)
      ]);

      // Get recent announcements
      const announcements = await db.query(`
        SELECT * FROM announcements 
        WHERE is_active = 1 AND JSON_CONTAINS(target_roles, '"student"')
        ORDER BY created_at DESC 
        LIMIT 5
      `);

      // Get unread notifications count
      const unreadNotifications = await db.query(`
        SELECT COUNT(*) as count FROM notifications 
        WHERE user_id = ? AND is_read = 0
      `, [studentId]);

      res.render('student/dashboard', {
        title: 'Student Dashboard - EduLMS',
        layout: 'layouts/student-layout',
        profile,
        academicSummary,
        recentAssignments: recentAssignments.assignments,
        upcomingAssignments: upcomingDeadlines.assignments,
        announcements,
        unreadNotifications: unreadNotifications[0].count,
        currentPage: 'dashboard'
      });
    } catch (error) {
      console.error('Student dashboard error:', error);
      req.flash('error_msg', 'Error loading dashboard');
      res.render('student/dashboard', {
        title: 'Student Dashboard - EduLMS',
        layout: 'layouts/student-layout',
        profile: {},
        academicSummary: {},
        recentAssignments: [],
        upcomingAssignments: [],
        announcements: [],
        unreadNotifications: 0,
        currentPage: 'dashboard'
      });
    }
  },

  // View student courses
  courses: async (req, res) => {
    try {
      const studentId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || 'active';
      const search = req.query.search || '';

      const filters = {};
      if (search) filters.search = search;

      const coursesData = await Student.getCourses(studentId, page, limit, status);

      res.render('student/courses/list', {
        title: 'My Courses - EduLMS',
        layout: 'layouts/student-layout',
        courses: coursesData.courses,
        pagination: {
          current: page,
          pages: coursesData.totalPages,
          total: coursesData.total
        },
        filters: { status, search },
        currentPage: 'courses'
      });
    } catch (error) {
      console.error('Student courses error:', error);
      req.flash('error_msg', 'Error loading courses');
      res.render('student/courses/list', {
        title: 'My Courses - EduLMS',
        layout: 'layouts/student-layout',
        courses: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: { status: 'active', search: '' },
        currentPage: 'courses'
      });
    }
  },

  // View course details
  viewCourse: async (req, res) => {
    try {
      const studentId = req.user.id;
      const courseId = req.params.id;

      // Verify student is enrolled in this course
      const enrollment = await db.query(`
        SELECT * FROM enrollments 
        WHERE student_id = ? AND course_id = ? AND status = 'active'
      `, [studentId, courseId]);

      if (enrollment.length === 0) {
        req.flash('error_msg', 'You are not enrolled in this course');
        return res.redirect('/student/courses');
      }

      const [course, assignments, materials] = await Promise.all([
        Course.findById(courseId),
        Assignment.getAssignments({ course_id: courseId, status: 'published' }),
        db.query(`
          SELECT * FROM course_materials 
          WHERE course_id = ? 
          ORDER BY created_at DESC
        `, [courseId])
      ]);

      if (!course) {
        req.flash('error_msg', 'Course not found');
        return res.redirect('/student/courses');
      }

      res.render('student/courses/view', {
        title: `${course.course_code} - ${course.title}`,
        layout: 'layouts/student-layout',
        course,
        assignments,
        materials,
        currentPage: 'courses'
      });
    } catch (error) {
      console.error('View course error:', error);
      req.flash('error_msg', 'Error loading course');
      res.redirect('/student/courses');
    }
  },

  // Enroll in a course
  enrollCourse: async (req, res) => {
    try {
      const studentId = req.user.id;
      const courseId = req.params.id;

      const result = await Student.enrollInCourse(studentId, courseId);

      if (result.reactivated) {
        req.flash('success_msg', 'Course enrollment reactivated successfully');
      } else {
        req.flash('success_msg', 'Successfully enrolled in the course');
      }

      res.redirect('/student/courses');

    } catch (error) {
      console.error('Enroll course error:', error);
      req.flash('error_msg', error.message);
      res.redirect('/student/courses/available');
    }
  },

  // Drop a course
  dropCourse: async (req, res) => {
    try {
      const studentId = req.user.id;
      const courseId = req.params.id;

      await Student.dropCourse(studentId, courseId);

      req.flash('success_msg', 'Successfully dropped the course');
      res.redirect('/student/courses');

    } catch (error) {
      console.error('Drop course error:', error);
      req.flash('error_msg', error.message);
      res.redirect('/student/courses');
    }
  },

  // View available courses for enrollment
  availableCourses: async (req, res) => {
    try {
      const studentId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12;
      const department = req.query.department || '';
      const search = req.query.search || '';

      const filters = {};
      if (department) filters.department = department;
      if (search) filters.search = search;

      const coursesData = await Student.getAvailableCourses(studentId, page, limit);

      // Get unique departments for filter
      const departments = await db.query(`
        SELECT DISTINCT department FROM courses 
        WHERE department IS NOT NULL AND status = 'active'
        ORDER BY department
      `);

      res.render('student/courses/enroll', {
        title: 'Available Courses - EduLMS',
        layout: 'layouts/student-layout',
        courses: coursesData.courses,
        pagination: {
          current: page,
          pages: coursesData.totalPages,
          total: coursesData.total
        },
        filters: { department, search },
        departments,
        currentPage: 'courses'
      });
    } catch (error) {
      console.error('Available courses error:', error);
      req.flash('error_msg', 'Error loading available courses');
      res.render('student/courses/enroll', {
        title: 'Available Courses - EduLMS',
        layout: 'layouts/student-layout',
        courses: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: { department: '', search: '' },
        departments: [],
        currentPage: 'courses'
      });
    }
  },

  // View assignments
  assignments: async (req, res) => {
    try {
      const studentId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || '';
      const course_id = req.query.course_id || '';

      const filters = {};
      if (status) filters.status = status;
      if (course_id) filters.course_id = course_id;

      const assignmentsData = await Student.getAssignments(studentId, filters, page, limit);

      // Get enrolled courses for filter
      const enrolledCourses = await db.query(`
        SELECT c.id, c.course_code, c.title 
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.student_id = ? AND e.status = 'active'
        ORDER BY c.course_code
      `, [studentId]);

      res.render('student/assignments/list', {
        title: 'My Assignments - EduLMS',
        layout: 'layouts/student-layout',
        assignments: assignmentsData.assignments,
        pagination: {
          current: page,
          pages: assignmentsData.totalPages,
          total: assignmentsData.total
        },
        filters,
        enrolledCourses,
        currentPage: 'assignments'
      });
    } catch (error) {
      console.error('Student assignments error:', error);
      req.flash('error_msg', 'Error loading assignments');
      res.render('student/assignments/list', {
        title: 'My Assignments - EduLMS',
        layout: 'layouts/student-layout',
        assignments: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: {},
        enrolledCourses: [],
        currentPage: 'assignments'
      });
    }
  },

  // View assignment details
  viewAssignment: async (req, res) => {
    try {
      const studentId = req.user.id;
      const assignmentId = req.params.id;

      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        req.flash('error_msg', 'Assignment not found');
        return res.redirect('/student/assignments');
      }

      // Verify student is enrolled in the course
      const enrollment = await db.query(`
        SELECT * FROM enrollments 
        WHERE student_id = ? AND course_id = ? AND status = 'active'
      `, [studentId, assignment.course_id]);

      if (enrollment.length === 0) {
        req.flash('error_msg', 'You are not enrolled in this course');
        return res.redirect('/student/assignments');
      }

      // Get submission if exists
      const submission = await db.query(`
        SELECT s.*, g.points_earned, g.grade, g.feedback, g.graded_at
        FROM submissions s
        LEFT JOIN grades g ON s.id = g.submission_id
        WHERE s.assignment_id = ? AND s.student_id = ?
      `, [assignmentId, studentId]);

      const canSubmit = await Assignment.canStudentSubmit(assignmentId, studentId);

      res.render('student/assignments/view', {
        title: `Assignment - ${assignment.title}`,
        layout: 'layouts/student-layout',
        assignment,
        submission: submission[0] || null,
        canSubmit,
        currentPage: 'assignments'
      });
    } catch (error) {
      console.error('View assignment error:', error);
      req.flash('error_msg', error.message || 'Error loading assignment');
      res.redirect('/student/assignments');
    }
  },

  // Show submit assignment form
  showSubmitAssignment: async (req, res) => {
    try {
      const studentId = req.user.id;
      const assignmentId = req.params.id;

      const canSubmit = await Assignment.canStudentSubmit(assignmentId, studentId);

      if (!canSubmit.canSubmit) {
        req.flash('error_msg', canSubmit.reason || 'Cannot submit this assignment');
        return res.redirect(`/student/assignments/${assignmentId}`);
      }

      const assignment = await Assignment.findById(assignmentId);

      res.render('student/assignments/submit', {
        title: `Submit Assignment - ${assignment.title}`,
        layout: 'layouts/student-layout',
        assignment,
        currentPage: 'assignments'
      });
    } catch (error) {
      console.error('Show submit assignment error:', error);
      req.flash('error_msg', error.message || 'Error loading submission form');
      res.redirect(`/student/assignments/${req.params.id}`);
    }
  },

  // Submit assignment
  submitAssignment: async (req, res) => {
    try {
      const studentId = req.user.id;
      const assignmentId = req.params.id;

      const { submission_text } = req.body;
      const file = req.file;

      const submissionData = {
        assignment_id: assignmentId,
        student_id: studentId,
        submission_text: submission_text || null
      };

      if (file) {
        submissionData.file_path = `/uploads/submissions/${file.filename}`;
        submissionData.file_name = file.originalname;
        submissionData.file_size = file.size;
      }

      const result = await Submission.create(submissionData);

      if (result.isLate) {
        req.flash('warning_msg', 'Assignment submitted successfully (Late submission)');
      } else {
        req.flash('success_msg', 'Assignment submitted successfully');
      }

      res.redirect(`/student/assignments/${assignmentId}`);

    } catch (error) {
      console.error('Submit assignment error:', error);
      req.flash('error_msg', error.message || 'Error submitting assignment');
      res.redirect(`/student/assignments/${req.params.id}/submit`);
    }
  },

  // View grades
  grades: async (req, res) => {
    try {
      const studentId = req.user.id;
      
      const [grades, academicSummary] = await Promise.all([
        Student.getGrades(studentId),
        Student.getAcademicSummary(studentId)
      ]);

      // Group grades by course
      const gradesByCourse = {};
      grades.forEach(grade => {
        const courseKey = grade.course_code;
        if (!gradesByCourse[courseKey]) {
          gradesByCourse[courseKey] = {
            course_code: grade.course_code,
            course_title: grade.course_title,
            credits: grade.credits,
            instructor_name: grade.instructor_name,
            course_grade: grade.course_grade,
            course_grade_points: grade.course_grade_points,
            assignments: []
          };
        }
        if (grade.assignment_title) {
          gradesByCourse[courseKey].assignments.push({
            assignment_title: grade.assignment_title,
            points_earned: grade.points_earned,
            max_points: grade.max_points,
            grade: grade.assignment_grade,
            grade_points: grade.assignment_grade_points,
            feedback: grade.feedback,
            graded_at: grade.graded_at
          });
        }
      });

      res.render('student/grades/overview', {
        title: 'My Grades - EduLMS',
        layout: 'layouts/student-layout',
        gradesByCourse: Object.values(gradesByCourse),
        academicSummary,
        currentPage: 'grades'
      });
    } catch (error) {
      console.error('Student grades error:', error);
      req.flash('error_msg', 'Error loading grades');
      res.render('student/grades/overview', {
        title: 'My Grades - EduLMS',
        layout: 'layouts/student-layout',
        gradesByCourse: [],
        academicSummary: {},
        currentPage: 'grades'
      });
    }
  },

  // View payment history
  payments: async (req, res) => {
    try {
      const studentId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const paymentsData = await Student.getPayments(studentId, page, limit);

      // Get fee structures for making new payments
      const feeStructures = await db.query(`
        SELECT * FROM fee_structures 
        WHERE is_active = 1 AND due_date >= CURDATE()
        ORDER BY fee_type, amount
      `);

      res.render('student/payments/history', {
        title: 'Payment History - EduLMS',
        layout: 'layouts/student-layout',
        payments: paymentsData.payments,
        summary: paymentsData.summary,
        pagination: {
          current: page,
          pages: paymentsData.totalPages,
          total: paymentsData.total
        },
        feeStructures,
        currentPage: 'payments'
      });
    } catch (error) {
      console.error('Student payments error:', error);
      req.flash('error_msg', 'Error loading payment history');
      res.render('student/payments/history', {
        title: 'Payment History - EduLMS',
        layout: 'layouts/student-layout',
        payments: [],
        summary: {},
        pagination: { current: 1, pages: 0, total: 0 },
        feeStructures: [],
        currentPage: 'payments'
      });
    }
  },

  // View student profile
  profile: async (req, res) => {
    try {
      const studentId = req.user.id;
      const profile = await Student.getProfile(studentId);

      res.render('student/profile/view', {
        title: 'My Profile - EduLMS',
        layout: 'layouts/student-layout',
        profile,
        currentPage: 'profile'
      });
    } catch (error) {
      console.error('Student profile error:', error);
      req.flash('error_msg', 'Error loading profile');
      res.render('student/profile/view', {
        title: 'My Profile - EduLMS',
        layout: 'layouts/student-layout',
        profile: {},
        currentPage: 'profile'
      });
    }
  },

  // View academic record
  academicRecord: async (req, res) => {
    try {
      const studentId = req.user.id;
      
      const [grades, academicSummary, enrollments] = await Promise.all([
        Student.getGrades(studentId),
        Student.getAcademicSummary(studentId),
        db.query(`
          SELECT e.*, c.course_code, c.title, c.credits, c.department
          FROM enrollments e
          JOIN courses c ON e.course_id = c.id
          WHERE e.student_id = ?
          ORDER BY e.enrolled_at DESC
        `, [studentId])
      ]);

      res.render('student/profile/academic-record', {
        title: 'Academic Record - EduLMS',
        layout: 'layouts/student-layout',
        grades,
        academicSummary,
        enrollments,
        currentPage: 'profile'
      });
    } catch (error) {
      console.error('Academic record error:', error);
      req.flash('error_msg', 'Error loading academic record');
      res.render('student/profile/academic-record', {
        title: 'Academic Record - EduLMS',
        layout: 'layouts/student-layout',
        grades: [],
        academicSummary: {},
        enrollments: [],
        currentPage: 'profile'
      });
    }
  }
};

module.exports = studentController;