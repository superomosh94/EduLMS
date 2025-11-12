const express = require('express');
const router = express.Router();

// Simple student auth middleware (since ensureStudentAuth doesn't exist)
const ensureStudentAuth = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role_name === 'student') {
    return next();
  }
  req.flash('error_msg', 'Please log in as student to access this page');
  res.redirect('/auth/login');
};

// Apply student auth middleware to all routes
router.use(ensureStudentAuth);

// Dashboard
router.get('/dashboard', (req, res) => {
  res.render('student/dashboard', {
    title: 'Student Dashboard',
    user: req.user
  });
});

// Course routes
router.get('/courses', (req, res) => {
  res.render('student/courses', {
    title: 'My Courses', 
    user: req.user
  });
});

// Assignment routes  
router.get('/assignments', (req, res) => {
  res.render('student/assignments', {
    title: 'My Assignments',
    user: req.user
  });
});

// Simple placeholder for assignment submission
router.post('/assignments/:assignmentId/submit', (req, res) => {
  req.flash('success', 'Assignment submitted successfully');
  res.redirect('/student/assignments');
});

// Grade routes
router.get('/grades', (req, res) => {
  res.render('student/grades', {
    title: 'My Grades',
    user: req.user
  });
});

// Notification routes
router.post('/notifications/:notificationId/read', (req, res) => {
  res.json({ success: true });
});

module.exports = router;