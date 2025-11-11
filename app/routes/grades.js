const express = require('express');
const router = express.Router();
const { isAuthenticated, canManageCourse, isEnrolledInCourse } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const gradeController = require('../controllers/academic/gradeController');
const { validateGradeEntry, validateGradeUpdate, validateGradeId, validateBulkGradeEntry } = require('../validators/gradeValidators');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Student grade viewing
router.get('/my-grades', gradeController.getMyGrades);
router.get('/my-grades/course/:courseId', isEnrolledInCourse, gradeController.getMyCourseGrades);
router.get('/my-grades/assignment/:assignmentId', gradeController.getMyAssignmentGrade);
router.get('/my-transcript', gradeController.getMyTranscript);
router.get('/my-gpa', gradeController.getMyGPA);

// Instructor grade management
router.get('/course/:courseId', canManageCourse, gradeController.getCourseGrades);
router.get('/assignment/:assignmentId', canManageCourse, gradeController.getAssignmentGrades);
router.post('/entry', canManageCourse, validateGradeEntry, gradeController.enterGrade);
router.put('/:gradeId', canManageCourse, validateGradeUpdate, gradeController.updateGrade);
router.delete('/:gradeId', canManageCourse, gradeController.deleteGrade);
router.post('/bulk-entry', canManageCourse, validateBulkGradeEntry, gradeController.bulkEnterGrades);

// Gradebook management
router.get('/gradebook/course/:courseId', canManageCourse, gradeController.getGradebook);
router.post('/gradebook/course/:courseId', canManageCourse, gradeController.updateGradebook);
router.get('/gradebook/course/:courseId/export', canManageCourse, gradeController.exportGradebook);

// Grade statistics and analytics
router.get('/stats/course/:courseId', canManageCourse, gradeController.getCourseGradeStats);
router.get('/stats/assignment/:assignmentId', canManageCourse, gradeController.getAssignmentGradeStats);
router.get('/distribution/course/:courseId', canManageCourse, gradeController.getGradeDistribution);

// Grade appeals and reviews
router.get('/appeals', gradeController.getGradeAppeals);
router.post('/:gradeId/appeal', gradeController.submitGradeAppeal);
router.put('/appeals/:appealId', canManageCourse, gradeController.reviewGradeAppeal);
router.get('/appeals/pending', canManageCourse, gradeController.getPendingAppeals);

// Transcript generation
router.get('/transcript/student/:studentId', gradeController.generateStudentTranscript);
router.get('/transcript/course/:courseId', canManageCourse, gradeController.generateCourseTranscript);

// Grade calculation and settings
router.get('/settings/course/:courseId', canManageCourse, gradeController.getGradeSettings);
router.post('/settings/course/:courseId', canManageCourse, gradeController.updateGradeSettings);
router.get('/calculation/course/:courseId', canManageCourse, gradeController.calculateFinalGrades);

// API endpoints
router.get('/api/my-summary', gradeController.getMyGradeSummary);
router.get('/api/course/:courseId/summary', canManageCourse, gradeController.getCourseGradeSummary);
router.get('/api/assignment/:assignmentId/average', canManageCourse, gradeController.getAssignmentAverage);

// Bulk operations
router.post('/import/course/:courseId', canManageCourse, gradeController.importGrades);
router.get('/template/course/:courseId', canManageCourse, gradeController.downloadGradeTemplate);

module.exports = router;