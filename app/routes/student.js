const express = require('express');
const router = express.Router();
const { isStudent, isAuthenticated, isEnrolledInCourse } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const studentController = require('../controllers/users/studentController');

// Apply student middleware to all routes
router.use(isAuthenticated);
router.use(isStudent);

// Student Dashboard
router.get('/dashboard', studentController.dashboard);

// Course Management
router.get('/courses', studentController.listCourses);
router.get('/courses/available', studentController.availableCourses);
router.get('/courses/:courseId', isEnrolledInCourse, studentController.viewCourse);
router.post('/courses/:courseId/enroll', studentController.enrollInCourse);
router.post('/courses/:courseId/drop', studentController.dropCourse);
router.get('/courses/:courseId/materials', isEnrolledInCourse, studentController.courseMaterials);

// Assignment Management
router.get('/assignments', studentController.listAssignments);
router.get('/assignments/:assignmentId', studentController.viewAssignment);
router.get('/assignments/:assignmentId/submit', studentController.showSubmitAssignment);
router.post('/assignments/:assignmentId/submit', studentController.submitAssignment);
router.get('/assignments/submitted/:submissionId', studentController.viewSubmission);

// Grades and Progress
router.get('/grades', studentController.gradesOverview);
router.get('/grades/course/:courseId', studentController.courseGrades);
router.get('/grades/transcript', studentController.academicTranscript);
router.get('/grades/progress', studentController.academicProgress);

// Payment Management
router.get('/payments/history', studentController.paymentHistory);
router.get('/payments/make-payment', studentController.showMakePayment);
router.post('/payments/make-payment', studentController.processPayment);
router.get('/payments/invoice/:invoiceId', studentController.viewInvoice);
router.get('/payments/fee-statement', studentController.feeStatement);
router.get('/payments/success/:paymentId', studentController.paymentSuccess);

// Profile Management
router.get('/profile', studentController.viewProfile);
router.get('/profile/edit', studentController.showEditProfile);
router.post('/profile/edit', studentController.updateProfile);
router.get('/profile/academic-record', studentController.academicRecord);

// Notifications
router.get('/notifications', studentController.listNotifications);
router.get('/notifications/:notificationId', studentController.viewNotification);
router.post('/notifications/mark-read', studentController.markNotificationsRead);

// API endpoints for student data
router.get('/api/courses/enrolled', studentController.getEnrolledCourses);
router.get('/api/assignments/pending', studentController.getPendingAssignments);
router.get('/api/grades/summary', studentController.getGradesSummary);
router.get('/api/payments/balance', studentController.getFeeBalance);

// File downloads
router.get('/download/material/:materialId', studentController.downloadCourseMaterial);
router.get('/download/assignment/:assignmentId', studentController.downloadAssignmentFile);
router.get('/download/transcript', studentController.downloadTranscript);

// Calendar and Schedule
router.get('/schedule', studentController.classSchedule);
router.get('/calendar', studentController.academicCalendar);
router.get('/api/calendar/events', studentController.getCalendarEvents);

// Support and Help
router.get('/support', studentController.supportResources);
router.post('/support/ticket', studentController.submitSupportTicket);

module.exports = router;