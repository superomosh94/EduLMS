const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/academic/assignmentController');
const { isAuthenticated, hasAnyRole } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Assignment browsing and viewing
router.get('/', assignmentController.listAssignments);
router.get('/course/:courseId', assignmentController.getCourseAssignments);
router.get('/:assignmentId', assignmentController.viewAssignment);

// Student submission routes
router.post('/:assignmentId/submit', assignmentController.submitAssignment);
router.get('/submissions/:submissionId', assignmentController.viewSubmission);
router.put('/submissions/:submissionId', assignmentController.updateSubmission);
router.delete('/submissions/:submissionId', assignmentController.deleteSubmission);

// Instructor-only routes
router.post('/create', 
  hasAnyRole(['admin', 'instructor']), 
  assignmentController.createAssignment
);

router.put('/:assignmentId', 
  hasAnyRole(['admin', 'instructor']), 
  assignmentController.updateAssignment
);

router.delete('/:assignmentId', 
  hasAnyRole(['admin', 'instructor']), 
  assignmentController.deleteAssignment
);

router.post('/:assignmentId/publish', 
  hasAnyRole(['admin', 'instructor']), 
  assignmentController.publishAssignment
);

router.post('/:assignmentId/unpublish', 
  hasAnyRole(['admin', 'instructor']), 
  assignmentController.unpublishAssignment
);

// Submission management (instructor only)
router.get('/:assignmentId/submissions', 
  hasAnyRole(['admin', 'instructor']), 
  assignmentController.getSubmissions
);

router.post('/submissions/:submissionId/grade', 
  hasAnyRole(['admin', 'instructor']), 
  assignmentController.gradeSubmission
);

// File downloads
router.get('/:assignmentId/download', 
  hasAnyRole(['admin', 'instructor']), 
  assignmentController.downloadAssignmentFiles
);

router.get('/submissions/:submissionId/download', assignmentController.downloadSubmissionFile);

// Analytics and reports
router.get('/:assignmentId/analytics', 
  hasAnyRole(['admin', 'instructor']), 
  assignmentController.getAssignmentAnalytics
);

router.get('/:assignmentId/statistics', 
  hasAnyRole(['admin', 'instructor']), 
  assignmentController.getAssignmentStatistics
);

module.exports = router;