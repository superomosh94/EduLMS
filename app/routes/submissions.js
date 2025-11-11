const express = require('express');
const router = express.Router();
const { isAuthenticated, canManageCourse } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const submissionController = require('../controllers/academic/submissionController');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Student submission management
router.get('/my-submissions', submissionController.getMySubmissions);
router.get('/:submissionId', submissionController.getSubmission);
router.post('/:assignmentId/submit', submissionController.createSubmission);
router.put('/:submissionId', submissionController.updateSubmission);
router.delete('/:submissionId', submissionController.deleteSubmission);
router.get('/:submissionId/download', submissionController.downloadSubmission);

// Instructor submission management
router.get('/assignment/:assignmentId', canManageCourse, submissionController.getAssignmentSubmissions);
router.get('/course/:courseId', canManageCourse, submissionController.getCourseSubmissions);
router.post('/:submissionId/grade', canManageCourse, submissionController.gradeSubmission);
router.post('/bulk/grade', canManageCourse, submissionController.bulkGradeSubmissions);
router.get('/:submissionId/feedback', canManageCourse, submissionController.getSubmissionFeedback);
router.post('/:submissionId/feedback', canManageCourse, submissionController.addFeedback);

// Submission analytics
router.get('/analytics/assignment/:assignmentId', canManageCourse, submissionController.getAssignmentAnalytics);
router.get('/analytics/course/:courseId', canManageCourse, submissionController.getCourseAnalytics);

// Late submissions management
router.get('/late/assignment/:assignmentId', canManageCourse, submissionController.getLateSubmissions);
router.post('/:submissionId/accept-late', canManageCourse, submissionController.acceptLateSubmission);
router.post('/:submissionId/reject-late', canManageCourse, submissionController.rejectLateSubmission);

// Plagiarism detection
router.get('/:submissionId/plagiarism-check', canManageCourse, submissionController.checkPlagiarism);
router.get('/assignment/:assignmentId/plagiarism-report', canManageCourse, submissionController.generatePlagiarismReport);

// Submission statistics
router.get('/stats/assignment/:assignmentId', submissionController.getAssignmentSubmissionStats);
router.get('/stats/course/:courseId', canManageCourse, submissionController.getCourseSubmissionStats);

// API endpoints
router.get('/api/my-pending', submissionController.getMyPendingSubmissions);
router.get('/api/assignment/:assignmentId/status', submissionController.getAssignmentSubmissionStatus);
router.get('/api/course/:courseId/submission-rate', canManageCourse, submissionController.getCourseSubmissionRate);

module.exports = router;