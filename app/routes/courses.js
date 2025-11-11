const express = require('express');
const router = express.Router();
const { isAuthenticated, isEnrolledInCourse, canManageCourse } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const courseController = require('../controllers/academic/courseController');
const { validateCourseCreation, validateCourseUpdate, validateCourseId, validateCourseQuery } = require('../validators/courseValidators');

// Public course routes (accessible without authentication)
router.get('/public', courseController.listPublicCourses);
router.get('/public/:courseId', courseController.viewPublicCourse);

// Apply authentication middleware to all other routes
router.use(isAuthenticated);

// Course browsing and enrollment
router.get('/', validateCourseQuery, courseController.listCourses);
router.get('/available', courseController.availableCourses);
router.get('/:courseId', validateCourseId, courseController.viewCourse);
router.post('/:courseId/enroll', validateCourseId, courseController.enrollInCourse);
router.post('/:courseId/drop', validateCourseId, courseController.dropCourse);

// Course materials (requires enrollment or instructor access)
router.get('/:courseId/materials', validateCourseId, isEnrolledInCourse, courseController.getCourseMaterials);
router.get('/:courseId/materials/:materialId', validateCourseId, isEnrolledInCourse, courseController.downloadMaterial);

// Course reviews and ratings
router.get('/:courseId/reviews', validateCourseId, courseController.getCourseReviews);
router.post('/:courseId/reviews', validateCourseId, isEnrolledInCourse, courseController.submitReview);
router.put('/:courseId/reviews/:reviewId', validateCourseId, isEnrolledInCourse, courseController.updateReview);

// Instructor-only routes
router.post('/create', courseController.createCourse);
router.put('/:courseId', validateCourseId, canManageCourse, validateCourseUpdate, courseController.updateCourse);
router.delete('/:courseId', validateCourseId, canManageCourse, courseController.deleteCourse);
router.post('/:courseId/materials', validateCourseId, canManageCourse, courseController.uploadMaterial);
router.delete('/:courseId/materials/:materialId', validateCourseId, canManageCourse, courseController.deleteMaterial);

// Course announcements
router.get('/:courseId/announcements', validateCourseId, isEnrolledInCourse, courseController.getAnnouncements);
router.post('/:courseId/announcements', validateCourseId, canManageCourse, courseController.createAnnouncement);

// Course progress tracking
router.get('/:courseId/progress', validateCourseId, isEnrolledInCourse, courseController.getCourseProgress);
router.post('/:courseId/progress', validateCourseId, isEnrolledInCourse, courseController.updateProgress);

// Search and filter courses
router.get('/search/:query', courseController.searchCourses);
router.get('/category/:categoryId', courseController.getCoursesByCategory);
router.get('/instructor/:instructorId', courseController.getCoursesByInstructor);

// API endpoints for course data
router.get('/api/popular', courseController.getPopularCourses);
router.get('/api/recent', courseController.getRecentCourses);
router.get('/api/categories', courseController.getCategories);
router.get('/api/:courseId/stats', validateCourseId, canManageCourse, courseController.getCourseStats);

// Course completion and certificates
router.get('/:courseId/certificate', validateCourseId, isEnrolledInCourse, courseController.generateCertificate);
router.post('/:courseId/complete', validateCourseId, isEnrolledInCourse, courseController.markCourseComplete);

// Bulk operations (admin/instructor only)
router.post('/bulk/create', courseController.bulkCreateCourses);
router.post('/bulk/update', courseController.bulkUpdateCourses);

module.exports = router;