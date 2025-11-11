const express = require('express');
const router = express.Router();

// Import route files
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const studentRoutes = require('./student');
const instructorRoutes = require('./instructor');
const financeRoutes = require('./finance');
const courseRoutes = require('./courses');
const assignmentRoutes = require('./assignments');
const submissionRoutes = require('./submissions');
const gradeRoutes = require('./grades');
const paymentRoutes = require('./payments');
const enrollmentRoutes = require('./enrollments');
const notificationRoutes = require('./notifications');
const systemRoutes = require('./system');

// Home route
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    // Redirect to appropriate dashboard based on role
    const redirectPaths = {
      'admin': '/admin/dashboard',
      'instructor': '/instructor/dashboard',
      'student': '/student/dashboard',
      'finance_officer': '/finance/dashboard'
    };
    
    const redirectPath = redirectPaths[req.user.role_name] || '/dashboard';
    return res.redirect(redirectPath);
  }
  
  res.render('home', {
    title: 'EduLMS - Learning Management System',
    layout: 'layouts/layout'
  });
});

// About page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About EduLMS',
    layout: 'layouts/layout'
  });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us - EduLMS',
    layout: 'layouts/layout'
  });
});

// Use routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/student', studentRoutes);
router.use('/instructor', instructorRoutes);
router.use('/finance', financeRoutes);
router.use('/api/courses', courseRoutes);
router.use('/api/assignments', assignmentRoutes);
router.use('/api/submissions', submissionRoutes);
router.use('/api/grades', gradeRoutes);
router.use('/api/payments', paymentRoutes);
router.use('/api/enrollments', enrollmentRoutes);
router.use('/api/notifications', notificationRoutes);
router.use('/api/system', systemRoutes);

module.exports = router;