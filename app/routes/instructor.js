const express = require('express');
const router = express.Router();
const { isInstructor, isAuthenticated, canManageCourse } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const instructorController = require('../controllers/users/instructorController');
const { validateCourseCreation, validateCourseUpdate, validateCourseId } = require('../validators/courseValidators');
const { validateAssignmentCreation, validateAssignmentUpdate, validateAssignmentId } = require('../validators/assignmentValidators');

// Apply instructor middleware to all routes


router.use(isAuthenticated);
router.use(isInstructor);

// Instructor Dashboard
router.get('/dashboard', instructorController.dashboard);

// Course Management
router.get('/courses', instructorController.listCourses);
router.get('/courses/create', instructorController.showCreateCourse);
router.post('/courses/create', validateCourseCreation, instructorController.createCourse);
router.get('/courses/:courseId', validateCourseId, canManageCourse, instructorController.viewCourse);
router.get('/courses/:courseId/edit', validateCourseId, canManageCourse, instructorController.showEditCourse);
router.post('/courses/:courseId/edit', validateCourseId, canManageCourse, validateCourseUpdate, instructorController.updateCourse);
router.post('/courses/:courseId/status', validateCourseId, canManageCourse, instructorController.updateCourseStatus);
router.get('/courses/:courseId/students', validateCourseId, canManageCourse, instructorController.courseStudents);
router.get('/courses/:courseId/materials', validateCourseId, canManageCourse, instructorController.courseMaterials);
router.post('/courses/:courseId/materials', validateCourseId, canManageCourse, instructorController.uploadCourseMaterial);

// Assignment Management
router.get('/assignments', instructorController.listAssignments);
router.get('/assignments/create', instructorController.showCreateAssignment);
router.post('/assignments/create', validateAssignmentCreation, instructorController.createAssignment);
router.get('/assignments/:assignmentId', validateAssignmentId, instructorController.viewAssignment);
router.get('/assignments/:assignmentId/edit', validateAssignmentId, instructorController.showEditAssignment);
router.post('/assignments/:assignmentId/edit', validateAssignmentId, validateAssignmentUpdate, instructorController.updateAssignment);
router.post('/assignments/:assignmentId/status', validateAssignmentId, instructorController.updateAssignmentStatus);
router.post('/assignments/:assignmentId/delete', validateAssignmentId, instructorController.deleteAssignment);

// Submission Management
router.get('/submissions', instructorController.listSubmissions);
router.get('/submissions/assignment/:assignmentId', validateAssignmentId, instructorController.assignmentSubmissions);
router.get('/submissions/:submissionId', instructorController.viewSubmission);
router.get('/submissions/:submissionId/grade', instructorController.showGradeSubmission);
router.post('/submissions/:submissionId/grade', instructorController.gradeSubmission);
router.post('/submissions/bulk-grade', instructorController.bulkGradeSubmissions);
router.get('/submissions/:submissionId/download', instructorController.downloadSubmission);

// Grade Management
router.get('/grades/manage', instructorController.manageGrades);
router.get('/grades/entry', instructorController.showGradeEntry);
router.post('/grades/entry', instructorController.enterGrade);
router.get('/grades/report', instructorController.gradeReport);
router.get('/grades/generate-pdf', instructorController.generateGradePDF);
router.get('/grades/gradebook/:courseId', validateCourseId, canManageCourse, instructorController.gradebook);

// Attendance Management
router.get('/attendance/take', instructorController.showTakeAttendance);
router.post('/attendance/take', instructorController.takeAttendance);
router.get('/attendance/view', instructorController.viewAttendance);
router.get('/attendance/reports', instructorController.attendanceReports);

// Profile Management
router.get('/profile', instructorController.viewProfile);
router.get('/profile/edit', instructorController.showEditProfile);
router.post('/profile/edit', instructorController.updateProfile);

// Notifications
router.get('/notifications', instructorController.listNotifications);
router.get('/notifications/create', instructorController.showCreateNotification);
router.post('/notifications/create', instructorController.createNotification);
router.get('/notifications/:notificationId', instructorController.viewNotification);

// Analytics and Reports
router.get('/analytics/courses', instructorController.courseAnalytics);
router.get('/analytics/students', instructorController.studentAnalytics);
router.get('/analytics/performance', instructorController.performanceAnalytics);

// API endpoints for instructor
router.get('/api/courses/stats', instructorController.getCourseStats);
router.get('/api/assignments/stats', instructorController.getAssignmentStats);
router.get('/api/students/performance', instructorController.getStudentPerformance);
router.get('/api/submissions/pending', instructorController.getPendingSubmissions);

// File uploads and downloads
router.post('/upload/material', instructorController.uploadMaterial);
router.get('/download/template/:templateType', instructorController.downloadTemplate);
router.post('/upload/grades', instructorController.uploadGrades);

// Communication
router.get('/communication/students', instructorController.studentCommunication);
router.post('/communication/send-message', instructorController.sendMessageToStudents);

module.exports = router;