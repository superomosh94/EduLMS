const express = require('express');
const router = express.Router();
const { isAuthenticated, isEnrolledInCourse, canManageCourse } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const assignmentController = require('../controllers/academic/assignmentController');
const { validateAssignmentCreation, validateAssignmentUpdate, validateAssignmentId, validateAssignmentQuery } = require('../validators/assignmentValidators');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Assignment browsing and viewing
router.get('/', validateAssignmentQuery, assignmentController.listAssignments);
router.get('/course/:courseId', assignmentController.getCourseAssignments);
router.get('/:assignmentId', validateAssignmentId, assignmentController.viewAssignment);

// Student submission routes (requires enrollment)
router.get('/:assignmentId/submit', validateAssignmentId, isEnrolledInCourse, assignmentController.showSubmitAssignment);
router.post('/:assignmentId/submit', validateAssignmentId, isEnrolledInCourse, assignmentController.submitAssignment);
router.get('/submissions/:submissionId', assignmentController.viewSubmission);
router.put('/submissions/:submissionId', assignmentController.updateSubmission);
router.delete('/submissions/:submissionId', assignmentController.deleteSubmission);

// Instructor-only routes
router.post('/create', assignmentController.createAssignment);
router.put('/:assignmentId', validateAssignmentId, canManageCourse, validateAssignmentUpdate, assignmentController.updateAssignment);
router.delete('/:assignmentId', validateAssignmentId, canManageCourse, assignmentController.deleteAssignment);
router.post('/:assignmentId/publish', validateAssignmentId, canManageCourse, assignmentController.publishAssignment);
router.post('/:assignmentId/unpublish', validateAssignmentId, canManageCourse, assignmentController.unpublishAssignment);

// Submission management (instructor only)
router.get('/:assignmentId/submissions', validateAssignmentId, canManageCourse, assignmentController.getSubmissions);
router.get('/submissions/:submissionId/grade', canManageCourse, assignmentController.showGradeSubmission);
router.post('/submissions/:submissionId/grade', canManageCourse, assignmentController.gradeSubmission);
router.post('/submissions/bulk-grade', canManageCourse, assignmentController.bulkGradeSubmissions);

// Assignment extensions
router.get('/:assignmentId/extensions', validateAssignmentId, canManageCourse, assignmentController.getExtensions);
router.post('/:assignmentId/extensions', validateAssignmentId, canManageCourse, assignmentController.grantExtension);
router.put('/extensions/:extensionId', canManageCourse, assignmentController.updateExtension);

// File downloads
router.get('/:assignmentId/download', validateAssignmentId, canManageCourse, assignmentController.downloadAssignmentFiles);
router.get('/submissions/:submissionId/download', assignmentController.downloadSubmissionFile);

// Analytics and reports
router.get('/:assignmentId/analytics', validateAssignmentId, canManageCourse, assignmentController.getAssignmentAnalytics);
router.get('/:assignmentId/statistics', validateAssignmentId, canManageCourse, assignmentController.getAssignmentStatistics);

// Plagiarism check (instructor only)
router.get('/:assignmentId/plagiarism', validateAssignmentId, canManageCourse, assignmentController.checkPlagiarism);
router.get('/:assignmentId/similarity-report', validateAssignmentId, canManageCourse, assignmentController.generateSimilarityReport);

// API endpoints for assignment data
router.get('/api/pending', assignmentController.getPendingAssignments);
router.get('/api/upcoming', assignmentController.getUpcomingAssignments);
router.get('/api/:assignmentId/submissions-count', validateAssignmentId, canManageCourse, assignmentController.getSubmissionsCount);
router.get('/api/course/:courseId/assignments-stats', assignmentController.getCourseAssignmentsStats);

// Bulk operations
router.post('/bulk/create', assignmentController.bulkCreateAssignments);
router.post('/bulk/update', assignmentController.bulkUpdateAssignments);

// Template downloads
router.get('/templates/download', assignmentController.downloadAssignmentTemplate);
router.post('/templates/upload', assignmentController.uploadAssignmentTemplate);

module.exports = router;