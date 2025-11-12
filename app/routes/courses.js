const express = require('express');
const router = express.Router();
const courseController = require('../controllers/academic/courseController');
const { isAuthenticated, hasAnyRole } = require('../middleware/auth');

// Public course routes (accessible without authentication)
router.get('/public', courseController.listPublicCourses);
router.get('/public/:courseId', courseController.viewPublicCourse);

// Apply authentication middleware to all other routes
router.use(isAuthenticated);

// Course browsing and enrollment
router.get('/', courseController.listCourses);
router.get('/available', courseController.availableCourses);
router.get('/:courseId', courseController.viewCourse);
router.post('/:courseId/enroll', courseController.enrollInCourse);
router.post('/:courseId/drop', courseController.dropCourse);

// Course materials (requires enrollment or instructor access)
router.get('/:courseId/materials', courseController.getCourseMaterials);
router.get('/:courseId/materials/:materialId', courseController.downloadMaterial);

// Course reviews and ratings
router.get('/:courseId/reviews', courseController.getCourseReviews);
router.post('/:courseId/reviews', courseController.submitReview);

// Instructor-only routes
router.post('/create', 
  hasAnyRole(['admin', 'instructor']), 
  courseController.createCourse
);

router.put('/:courseId', 
  hasAnyRole(['admin', 'instructor']), 
  courseController.updateCourse
);

router.delete('/:courseId', 
  hasAnyRole(['admin', 'instructor']), 
  courseController.deleteCourse
);

router.post('/:courseId/materials', 
  hasAnyRole(['admin', 'instructor']), 
  courseController.uploadMaterial
);

router.delete('/:courseId/materials/:materialId', 
  hasAnyRole(['admin', 'instructor']), 
  courseController.deleteMaterial
);

// Course announcements
router.get('/:courseId/announcements', courseController.getAnnouncements);
router.post('/:courseId/announcements', 
  hasAnyRole(['admin', 'instructor']), 
  courseController.createAnnouncement
);

// Course progress tracking
router.get('/:courseId/progress', courseController.getCourseProgress);
router.post('/:courseId/progress', courseController.updateProgress);

// Search and filter courses
router.get('/search/:query', courseController.searchCourses);
router.get('/category/:categoryId', courseController.getCoursesByCategory);
router.get('/instructor/:instructorId', courseController.getCoursesByInstructor);

// Course completion and certificates
router.get('/:courseId/certificate', courseController.generateCertificate);
router.post('/:courseId/complete', courseController.markCourseComplete);

module.exports = router;