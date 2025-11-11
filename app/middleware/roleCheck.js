const { ROLES } = require('../../config/constants');

// Require specific roles
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.flash('error_msg', 'Please log in to access this resource');
      return res.redirect('/auth/login');
    }

    if (!allowedRoles.includes(req.user.role_name)) {
      req.flash('error_msg', 'You do not have permission to access this resource');
      
      // Redirect to appropriate dashboard based on role
      const redirectPaths = {
        [ROLES.ADMIN]: '/admin/dashboard',
        [ROLES.INSTRUCTOR]: '/instructor/dashboard',
        [ROLES.STUDENT]: '/student/dashboard',
        [ROLES.FINANCE_OFFICER]: '/finance/dashboard'
      };
      
      const redirectPath = redirectPaths[req.user.role_name] || '/dashboard';
      return res.redirect(redirectPath);
    }

    next();
  };
};

// Specific role checkers
const requireAdmin = requireRole([ROLES.ADMIN]);
const requireInstructor = requireRole([ROLES.INSTRUCTOR]);
const requireStudent = requireRole([ROLES.STUDENT]);
const requireFinance = requireRole([ROLES.FINANCE_OFFICER]);

// Check if user can access their own data
const canAccessUserData = (req, res, next) => {
  if (req.isAuthenticated() && 
      (req.user.role_name === ROLES.ADMIN || 
       parseInt(req.params.userId) === req.user.id)) {
    return next();
  }
  
  req.flash('error_msg', 'Access denied');
  
  const redirectPaths = {
    [ROLES.ADMIN]: '/admin/dashboard',
    [ROLES.INSTRUCTOR]: '/instructor/dashboard',
    [ROLES.STUDENT]: '/student/dashboard',
    [ROLES.FINANCE_OFFICER]: '/finance/dashboard'
  };
  
  const redirectPath = redirectPaths[req.user.role_name] || '/dashboard';
  res.redirect(redirectPath);
};

// Check if user owns the resource (for instructors/students)
const isResourceOwner = (resourceType) => {
  return async (req, res, next) => {
    try {
      const db = require('../../config/database');
      const resourceId = req.params.id;
      let userId = req.user.id;
      
      let query;
      let params = [resourceId];
      
      switch (resourceType) {
        case 'course':
          query = 'SELECT teacher_id FROM courses WHERE id = ?';
          break;
        case 'assignment':
          query = `
            SELECT a.teacher_id 
            FROM assignments a 
            JOIN courses c ON a.course_id = c.id 
            WHERE a.id = ?
          `;
          break;
        case 'submission':
          query = 'SELECT student_id FROM submissions WHERE id = ?';
          break;
        case 'enrollment':
          query = 'SELECT student_id FROM enrollments WHERE id = ?';
          break;
        default:
          return next(new Error('Invalid resource type'));
      }
      
      const results = await db.query(query, params);
      
      if (results.length === 0) {
        req.flash('error_msg', 'Resource not found');
        return res.redirect('back');
      }
      
      const ownerId = results[0][Object.keys(results[0])[0]];
      
      if (parseInt(ownerId) !== parseInt(userId) && req.user.role_name !== ROLES.ADMIN) {
        req.flash('error_msg', 'You do not have permission to access this resource');
        return res.redirect('back');
      }
      
      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      req.flash('error_msg', 'Error verifying resource ownership');
      res.redirect('back');
    }
  };
};

module.exports = {
  requireRole,
  requireAdmin,
  requireInstructor,
  requireStudent,
  requireFinance,
  canAccessUserData,
  isResourceOwner
};