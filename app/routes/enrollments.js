const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/academic/enrollmentController');
const { isAuthenticated, hasAnyRole } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Student enrollment management
router.get('/my-enrollments', enrollmentController.getStudentEnrollments);
router.post('/self-enroll', enrollmentController.selfEnroll);
router.put('/:enrollmentId/drop', enrollmentController.dropEnrollment);
router.put('/:enrollmentId/status', enrollmentController.updateEnrollmentStatus);

// Instructor enrollment management
router.get('/course/:courseId', 
  hasAnyRole(['admin', 'instructor']), 
  enrollmentController.getCourseEnrollments
);

router.post('/enroll-student', 
  hasAnyRole(['admin', 'instructor']), 
  enrollmentController.enrollStudent
);

router.post('/bulk-enroll', 
  hasAnyRole(['admin', 'instructor']), 
  enrollmentController.bulkEnrollStudents
);

// Enrollment statistics
router.get('/stats', enrollmentController.getEnrollmentStats);

module.exports = router;