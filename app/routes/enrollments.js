const express = require('express');
const router = express.Router();
const { isAuthenticated, canManageCourse } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const enrollmentController = require('../controllers/academic/enrollmentController');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Student enrollment management
router.get('/my-enrollments', enrollmentController.getMyEnrollments);
router.post('/course/:courseId/enroll', enrollmentController.enrollInCourse);
router.post('/course/:courseId/drop', enrollmentController.dropCourse);
router.get('/course/:courseId/status', enrollmentController.getEnrollmentStatus);

// Instructor enrollment management
router.get('/course/:courseId', canManageCourse, enrollmentController.getCourseEnrollments);
router.post('/course/:courseId/enroll-student', canManageCourse, enrollmentController.enrollStudent);
router.post('/course/:courseId/remove-student', canManageCourse, enrollmentController.removeStudent);
router.put('/:enrollmentId/status', canManageCourse, enrollmentController.updateEnrollmentStatus);

// Enrollment analytics
router.get('/stats/course/:courseId', canManageCourse, enrollmentController.getCourseEnrollmentStats);
router.get('/stats/overview', enrollmentController.getEnrollmentOverview);

// Waitlist management
router.get('/course/:courseId/waitlist', canManageCourse, enrollmentController.getCourseWaitlist);
router.post('/course/:courseId/waitlist', enrollmentController.joinWaitlist);
router.post('/course/:courseId/waitlist/:waitlistId/approve', canManageCourse, enrollmentController.approveWaitlist);

// Bulk enrollment operations
router.post('/bulk/enroll', canManageCourse, enrollmentController.bulkEnrollStudents);
router.post('/bulk/update', canManageCourse, enrollmentController.bulkUpdateEnrollments);

// Enrollment reports
router.get('/reports/course-enrollment', enrollmentController.getCourseEnrollmentReport);
router.get('/reports/student-enrollment', enrollmentController.getStudentEnrollmentReport);

// API endpoints
router.get('/api/my-current', enrollmentController.getMyCurrentEnrollments);
router.get('/api/course/:courseId/enrollment-count', enrollmentController.getCourseEnrollmentCount);
router.get('/api/available-courses', enrollmentController.getAvailableCourses);

module.exports = router;