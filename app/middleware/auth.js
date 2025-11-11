const { ROLES } = require('../../config/constants');

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  req.flash('error_msg', 'Please log in to access this page');
  res.redirect('/auth/login');
};

// Check if user is not authenticated (for login/register pages)
const isNotAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  
  // Redirect to appropriate dashboard based on role
  let redirectUrl = '/dashboard';
  switch (req.user.role_name) {
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
  
  res.redirect(redirectUrl);
};

// Check if user has specific role
const hasRole = (role) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.flash('error_msg', 'Please log in to access this page');
      return res.redirect('/auth/login');
    }

    if (req.user.role_name === role) {
      return next();
    }

    req.flash('error_msg', 'You do not have permission to access this page');
    res.redirect('/dashboard');
  };
};

// Check if user has any of the specified roles
const hasAnyRole = (roles) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.flash('error_msg', 'Please log in to access this page');
      return res.redirect('/auth/login');
    }

    if (roles.includes(req.user.role_name)) {
      return next();
    }

    req.flash('error_msg', 'You do not have permission to access this page');
    res.redirect('/dashboard');
  };
};

// Admin role check
const isAdmin = hasRole(ROLES.ADMIN);

// Instructor role check
const isInstructor = hasRole(ROLES.INSTRUCTOR);

// Student role check
const isStudent = hasRole(ROLES.STUDENT);

// Finance officer role check
const isFinanceOfficer = hasRole(ROLES.FINANCE_OFFICER);

// Admin or Instructor role check
const isAdminOrInstructor = hasAnyRole([ROLES.ADMIN, ROLES.INSTRUCTOR]);

// Admin or Finance role check
const isAdminOrFinance = hasAnyRole([ROLES.ADMIN, ROLES.FINANCE_OFFICER]);

// Check if user can access student-specific resources
const canAccessStudentResources = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash('error_msg', 'Please log in to access this page');
    return res.redirect('/auth/login');
  }

  // Admin and instructors can access student resources
  if ([ROLES.ADMIN, ROLES.INSTRUCTOR].includes(req.user.role_name)) {
    return next();
  }

  // Students can only access their own resources
  if (req.user.role_name === ROLES.STUDENT) {
    if (req.params.studentId && parseInt(req.params.studentId) !== req.user.id) {
      req.flash('error_msg', 'You can only access your own student resources');
      return res.redirect('/student/dashboard');
    }
    return next();
  }

  req.flash('error_msg', 'You do not have permission to access student resources');
  res.redirect('/dashboard');
};

// Check if user can access instructor-specific resources
const canAccessInstructorResources = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash('error_msg', 'Please log in to access this page');
    return res.redirect('/auth/login');
  }

  // Admin can access all instructor resources
  if (req.user.role_name === ROLES.ADMIN) {
    return next();
  }

  // Instructors can only access their own resources
  if (req.user.role_name === ROLES.INSTRUCTOR) {
    if (req.params.instructorId && parseInt(req.params.instructorId) !== req.user.id) {
      req.flash('error_msg', 'You can only access your own instructor resources');
      return res.redirect('/instructor/dashboard');
    }
    return next();
  }

  req.flash('error_msg', 'You do not have permission to access instructor resources');
  res.redirect('/dashboard');
};

// Check if user can manage courses
const canManageCourse = async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) {
      req.flash('error_msg', 'Please log in to access this page');
      return res.redirect('/auth/login');
    }

    const db = require('../../config/database');
    const courseId = req.params.courseId || req.body.course_id;

    if (!courseId) {
      return next(); // No specific course ID, rely on role checks
    }

    // Admin can manage all courses
    if (req.user.role_name === ROLES.ADMIN) {
      return next();
    }

    // Check if instructor owns the course
    if (req.user.role_name === ROLES.INSTRUCTOR) {
      const courses = await db.query(
        'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
        [courseId, req.user.id]
      );
      
      if (courses.length > 0) {
        return next();
      }
      
      req.flash('error_msg', 'You can only manage your own courses');
      return res.redirect('/instructor/dashboard');
    }

    req.flash('error_msg', 'You do not have permission to manage courses');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Course management permission check error:', error);
    req.flash('error_msg', 'Error checking permissions');
    res.redirect('/dashboard');
  }
};

// Check if user is enrolled in course (for students)
const isEnrolledInCourse = async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) {
      req.flash('error_msg', 'Please log in to access this page');
      return res.redirect('/auth/login');
    }

    const db = require('../../config/database');
    const courseId = req.params.courseId || req.body.course_id;

    if (!courseId) {
      req.flash('error_msg', 'Course not specified');
      return res.redirect('/dashboard');
    }

    // Admin and instructors have access to all courses
    if ([ROLES.ADMIN, ROLES.INSTRUCTOR].includes(req.user.role_name)) {
      return next();
    }

    // Check if student is enrolled
    if (req.user.role_name === ROLES.STUDENT) {
      const enrollments = await db.query(
        'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? AND status = "active"',
        [courseId, req.user.id]
      );
      
      if (enrollments.length > 0) {
        return next();
      }
      
      req.flash('error_msg', 'You are not enrolled in this course');
      return res.redirect('/student/dashboard');
    }

    req.flash('error_msg', 'You do not have permission to access this course');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Course enrollment check error:', error);
    req.flash('error_msg', 'Error checking course enrollment');
    res.redirect('/dashboard');
  }
};

// API authentication middleware (for JSON requests)
const apiAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
};

// API role check middleware
const apiHasRole = (role) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role_name === role) {
      return next();
    }

    res.status(403).json({
      success: false,
      message: 'Insufficient permissions'
    });
  };
};

// Activity logging middleware
const logActivity = (action, tableName) => {
  return async (req, res, next) => {
    try {
      if (req.user && req.method !== 'GET') {
        const db = require('../../config/database');
        const recordId = req.params.id || req.body.id || null;
        
        await db.query(
          `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent, details) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            action,
            tableName,
            recordId,
            req.ip,
            req.get('User-Agent'),
            JSON.stringify({
              method: req.method,
              url: req.originalUrl,
              body: req.method !== 'GET' ? { ...req.body } : null
            })
          ]
        );
      }
      next();
    } catch (error) {
      console.error('Activity logging error:', error);
      next(); // Don't block request if logging fails
    }
  };
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated,
  hasRole,
  hasAnyRole,
  isAdmin,
  isInstructor,
  isStudent,
  isFinanceOfficer,
  isAdminOrInstructor,
  isAdminOrFinance,
  canAccessStudentResources,
  canAccessInstructorResources,
  canManageCourse,
  isEnrolledInCourse,
  apiAuth,
  apiHasRole,
  logActivity
};