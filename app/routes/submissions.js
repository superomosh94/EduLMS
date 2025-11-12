const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/academic/submissionController');
const { isAuthenticated, hasAnyRole } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Student submission routes
router.post('/:assignmentId/submit', submissionController.submitAssignment);
router.get('/:submissionId', submissionController.getStudentSubmission);
router.put('/:submissionId', submissionController.updateSubmission);
router.delete('/:submissionId', submissionController.deleteSubmission);
router.get('/history/:assignmentId/:studentId?', submissionController.getSubmissionHistory);

// File download routes
router.get('/:submissionId/download/:fileId', submissionController.downloadSubmissionFile);

// Instructor-only routes
router.get('/assignment/:assignmentId', 
  hasAnyRole(['admin', 'instructor']), 
  submissionController.getAssignmentSubmissions
);

router.post('/:submissionId/grade', 
  hasAnyRole(['admin', 'instructor']), 
  submissionController.gradeSubmission
);

router.get('/course/:courseId', 
  hasAnyRole(['admin', 'instructor']), 
  submissionController.getCourseSubmissions
);

// Student's own submissions
router.get('/my-submissions', submissionController.getMySubmissions);

module.exports = router;