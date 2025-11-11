const { body, param, query } = require('express-validator');
const Course = require('../models/Course');
const { COURSE_STATUS } = require('../../config/constants');

const courseValidators = {
  // Course creation validation
  validateCourseCreation: [
    body('title')
      .trim()
      .notEmpty().withMessage('Course title is required')
      .isLength({ min: 5, max: 200 }).withMessage('Course title must be between 5 and 200 characters'),
    
    body('code')
      .trim()
      .notEmpty().withMessage('Course code is required')
      .isLength({ min: 3, max: 20 }).withMessage('Course code must be between 3 and 20 characters')
      .matches(/^[A-Z0-9\-]+$/).withMessage('Course code can only contain uppercase letters, numbers, and hyphens')
      .custom(async (code) => {
        const existingCourse = await Course.findByCode(code);
        if (existingCourse) {
          throw new Error('Course code already exists');
        }
        return true;
      }),
    
    body('description')
      .trim()
      .notEmpty().withMessage('Course description is required')
      .isLength({ min: 10, max: 2000 }).withMessage('Course description must be between 10 and 2000 characters'),
    
    body('instructor_id')
      .isInt({ min: 1 }).withMessage('Please select a valid instructor'),
    
    body('category_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Please select a valid category'),
    
    body('credits')
      .isFloat({ min: 0.5, max: 10 }).withMessage('Credits must be between 0.5 and 10'),
    
    body('duration')
      .isInt({ min: 1, max: 52 }).withMessage('Duration must be between 1 and 52 weeks'),
    
    body('max_students')
      .isInt({ min: 1, max: 500 }).withMessage('Maximum students must be between 1 and 500'),
    
    body('start_date')
      .isDate().withMessage('Please provide a valid start date')
      .custom((value) => {
        const startDate = new Date(value);
        const today = new Date();
        if (startDate < today) {
          throw new Error('Start date cannot be in the past');
        }
        return true;
      }),
    
    body('end_date')
      .isDate().withMessage('Please provide a valid end date')
      .custom((value, { req }) => {
        const startDate = new Date(req.body.start_date);
        const endDate = new Date(value);
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    
    body('syllabus')
      .optional()
      .isLength({ max: 5000 }).withMessage('Syllabus must not exceed 5000 characters'),
    
    body('requirements')
      .optional()
      .isLength({ max: 1000 }).withMessage('Requirements must not exceed 1000 characters'),
    
    body('learning_outcomes')
      .optional()
      .isLength({ max: 2000 }).withMessage('Learning outcomes must not exceed 2000 characters')
  ],

  // Course update validation
  validateCourseUpdate: [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 5, max: 200 }).withMessage('Course title must be between 5 and 200 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ min: 10, max: 2000 }).withMessage('Course description must be between 10 and 2000 characters'),
    
    body('category_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Please select a valid category'),
    
    body('credits')
      .optional()
      .isFloat({ min: 0.5, max: 10 }).withMessage('Credits must be between 0.5 and 10'),
    
    body('duration')
      .optional()
      .isInt({ min: 1, max: 52 }).withMessage('Duration must be between 1 and 52 weeks'),
    
    body('max_students')
      .optional()
      .isInt({ min: 1, max: 500 }).withMessage('Maximum students must be between 1 and 500'),
    
    body('start_date')
      .optional()
      .isDate().withMessage('Please provide a valid start date'),
    
    body('end_date')
      .optional()
      .isDate().withMessage('Please provide a valid end date')
      .custom((value, { req }) => {
        if (req.body.start_date) {
          const startDate = new Date(req.body.start_date);
          const endDate = new Date(value);
          if (endDate <= startDate) {
            throw new Error('End date must be after start date');
          }
        }
        return true;
      }),
    
    body('status')
      .optional()
      .isIn(Object.values(COURSE_STATUS)).withMessage('Invalid course status'),
    
    body('syllabus')
      .optional()
      .isLength({ max: 5000 }).withMessage('Syllabus must not exceed 5000 characters'),
    
    body('requirements')
      .optional()
      .isLength({ max: 1000 }).withMessage('Requirements must not exceed 1000 characters'),
    
    body('learning_outcomes')
      .optional()
      .isLength({ max: 2000 }).withMessage('Learning outcomes must not exceed 2000 characters')
  ],

  // Course ID parameter validation
  validateCourseId: [
    param('courseId')
      .isInt({ min: 1 }).withMessage('Course ID must be a positive integer')
      .custom(async (courseId) => {
        const course = await Course.findById(courseId);
        if (!course) {
          throw new Error('Course not found');
        }
        return true;
      })
  ],

  // Course query parameters validation
  validateCourseQuery: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer')
      .default(1),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
      .default(10),
    
    query('status')
      .optional()
      .isIn(Object.values(COURSE_STATUS)).withMessage('Invalid course status'),
    
    query('category_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid category ID'),
    
    query('instructor_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid instructor ID'),
    
    query('search')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Search term must be between 2 and 100 characters')
      .trim(),
    
    query('sort')
      .optional()
      .isIn(['title', 'code', 'created_at', 'start_date', 'credits']).withMessage('Invalid sort field'),
    
    query('order')
      .optional()
      .isIn(['asc', 'desc']).withMessage('Order must be either asc or desc')
  ],

  // Course material validation
  validateCourseMaterial: [
    body('title')
      .trim()
      .notEmpty().withMessage('Material title is required')
      .isLength({ min: 2, max: 200 }).withMessage('Material title must be between 2 and 200 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
    
    body('type')
      .isIn(['document', 'video', 'link', 'assignment', 'other']).withMessage('Invalid material type'),
    
    body('url')
      .optional()
      .if(body('type').equals('link'))
      .isURL().withMessage('Please provide a valid URL')
      .custom((value, { req }) => {
        if (req.body.type === 'link' && !value) {
          throw new Error('URL is required for link type materials');
        }
        return true;
      }),
    
    body('is_public')
      .optional()
      .isBoolean().withMessage('is_public must be a boolean value')
  ],

  // Course enrollment validation
  validateEnrollment: [
    body('student_id')
      .isInt({ min: 1 }).withMessage('Please select a valid student'),
    
    body('course_id')
      .isInt({ min: 1 }).withMessage('Please select a valid course')
      .custom(async (courseId, { req }) => {
        const course = await Course.findById(courseId);
        if (!course) {
          throw new Error('Course not found');
        }
        
        // Check if course has available slots
        if (course.enrollment_count >= course.max_students) {
          throw new Error('Course is full. No more enrollments allowed.');
        }
        
        return true;
      })
  ],

  // Bulk course import validation
  validateBulkImport: [
    body('courses')
      .isArray({ min: 1 }).withMessage('Courses array is required and cannot be empty')
      .custom((courses) => {
        if (courses.length > 50) {
          throw new Error('Cannot import more than 50 courses at once');
        }
        return true;
      }),
    
    body('courses.*.title')
      .notEmpty().withMessage('Course title is required')
      .isLength({ min: 5, max: 200 }).withMessage('Course title must be between 5 and 200 characters'),
    
    body('courses.*.code')
      .notEmpty().withMessage('Course code is required')
      .isLength({ min: 3, max: 20 }).withMessage('Course code must be between 3 and 20 characters')
      .matches(/^[A-Z0-9\-]+$/).withMessage('Course code can only contain uppercase letters, numbers, and hyphens'),
    
    body('courses.*.description')
      .notEmpty().withMessage('Course description is required')
      .isLength({ min: 10, max: 2000 }).withMessage('Course description must be between 10 and 2000 characters'),
    
    body('courses.*.instructor_id')
      .isInt({ min: 1 }).withMessage('Invalid instructor ID'),
    
    body('courses.*.credits')
      .isFloat({ min: 0.5, max: 10 }).withMessage('Credits must be between 0.5 and 10'),
    
    body('courses.*.duration')
      .isInt({ min: 1, max: 52 }).withMessage('Duration must be between 1 and 52 weeks')
  ],

  // Course category validation
  validateCategory: [
    body('name')
      .trim()
      .notEmpty().withMessage('Category name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Category name must be between 2 and 100 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
    
    body('parent_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid parent category ID')
  ],

  // Course review/rating validation
  validateCourseReview: [
    body('rating')
      .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    
    body('comment')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Comment must not exceed 1000 characters')
  ],

  // Course search validation
  validateCourseSearch: [
    query('q')
      .notEmpty().withMessage('Search query is required')
      .isLength({ min: 2, max: 100 }).withMessage('Search query must be between 2 and 100 characters')
      .trim(),
    
    query('category')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid category ID'),
    
    query('instructor')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid instructor ID'),
    
    query('min_credits')
      .optional()
      .isFloat({ min: 0.5 }).withMessage('Minimum credits must be at least 0.5'),
    
    query('max_credits')
      .optional()
      .isFloat({ min: 0.5 }).withMessage('Maximum credits must be at least 0.5')
      .custom((value, { req }) => {
        if (req.query.min_credits && parseFloat(value) < parseFloat(req.query.min_credits)) {
          throw new Error('Maximum credits cannot be less than minimum credits');
        }
        return true;
      })
  ]
};

module.exports = courseValidators;