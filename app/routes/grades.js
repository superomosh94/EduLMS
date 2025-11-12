const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/academic/gradeController');
const { isAuthenticated, hasAnyRole } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Student grade viewing
router.get('/student-gradebook/:studentId?', gradeController.getStudentGradebook);

// Instructor grade management
router.get('/course/:courseId', 
  hasAnyRole(['admin', 'instructor']), 
  gradeController.getCourseGrades
);

router.post('/submission/:submissionId/grade', 
  hasAnyRole(['admin', 'instructor']), 
  gradeController.gradeSubmission
);

router.post('/assignment/:assignmentId/bulk-grade', 
  hasAnyRole(['admin', 'instructor']), 
  gradeController.bulkGradeSubmissions
);

router.put('/:gradeId/assignment/:assignmentId', 
  hasAnyRole(['admin', 'instructor']), 
  gradeController.updateGrade
);

// Grade statistics and analytics
router.get('/stats/course/:courseId', 
  hasAnyRole(['admin', 'instructor']), 
  gradeController.getGradeStatistics
);

// Export grades
router.get('/export/course/:courseId/:format?', 
  hasAnyRole(['admin', 'instructor']), 
  gradeController.exportGrades
);

module.exports = router;