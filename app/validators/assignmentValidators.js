const { body, param, query } = require('express-validator');
const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const { ASSIGNMENT_STATUS } = require('../../config/constants');

const assignmentValidators = {
  // Assignment creation validation
  validateAssignmentCreation: [
    body('title')
      .trim()
      .notEmpty().withMessage('Assignment title is required')
      .isLength({ min: 5, max: 200 }).withMessage('Assignment title must be between 5 and 200 characters'),
    
    body('description')
      .trim()
      .notEmpty().withMessage('Assignment description is required')
      .isLength({ min: 10, max: 2000 }).withMessage('Assignment description must be between 10 and 2000 characters'),
    
    body('course_id')
      .isInt({ min: 1 }).withMessage('Please select a valid course')
      .custom(async (courseId, { req }) => {
        const course = await Course.findById(courseId);
        if (!course) {
          throw new Error('Course not found');
        }
        
        // Check if user has permission to create assignments for this course
        if (req.user.role_name !== 'admin' && course.instructor_id !== req.user.id) {
          throw new Error('You do not have permission to create assignments for this course');
        }
        
        return true;
      }),
    
    body('total_points')
      .isFloat({ min: 1, max: 1000 }).withMessage('Total points must be between 1 and 1000'),
    
    body('due_date')
      .isISO8601().withMessage('Please provide a valid due date')
      .custom((value) => {
        const dueDate = new Date(value);
        const now = new Date();
        if (dueDate <= now) {
          throw new Error('Due date must be in the future');
        }
        return true;
      }),
    
    body('instructions')
      .optional()
      .trim()
      .isLength({ max: 5000 }).withMessage('Instructions must not exceed 5000 characters'),
    
    body('allowed_formats')
      .optional()
      .isArray().withMessage('Allowed formats must be an array')
      .custom((formats) => {
        const validFormats = ['pdf', 'doc', 'docx', 'txt', 'zip', 'jpg', 'png'];
        if (formats && formats.some(format => !validFormats.includes(format))) {
          throw new Error('Invalid file format specified');
        }
        return true;
      }),
    
    body('max_file_size')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Maximum file size must be between 1 and 50 MB'),
    
    body('max_attempts')
      .optional()
      .isInt({ min: 1, max: 10 }).withMessage('Maximum attempts must be between 1 and 10'),
    
    body('is_group_assignment')
      .optional()
      .isBoolean().withMessage('is_group_assignment must be a boolean value'),
    
    body('group_size')
      .optional()
      .if(body('is_group_assignment').equals('true'))
      .isInt({ min: 2, max: 10 }).withMessage('Group size must be between 2 and 10')
  ],

  // Assignment update validation
  validateAssignmentUpdate: [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 5, max: 200 }).withMessage('Assignment title must be between 5 and 200 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ min: 10, max: 2000 }).withMessage('Assignment description must be between 10 and 2000 characters'),
    
    body('total_points')
      .optional()
      .isFloat({ min: 1, max: 1000 }).withMessage('Total points must be between 1 and 1000'),
    
    body('due_date')
      .optional()
      .isISO8601().withMessage('Please provide a valid due date'),
    
    body('instructions')
      .optional()
      .trim()
      .isLength({ max: 5000 }).withMessage('Instructions must not exceed 5000 characters'),
    
    body('status')
      .optional()
      .isIn(Object.values(ASSIGNMENT_STATUS)).withMessage('Invalid assignment status'),
    
    body('allowed_formats')
      .optional()
      .isArray().withMessage('Allowed formats must be an array')
      .custom((formats) => {
        const validFormats = ['pdf', 'doc', 'docx', 'txt', 'zip', 'jpg', 'png'];
        if (formats && formats.some(format => !validFormats.includes(format))) {
          throw new Error('Invalid file format specified');
        }
        return true;
      }),
    
    body('max_file_size')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Maximum file size must be between 1 and 50 MB')
  ],

  // Assignment ID parameter validation
  validateAssignmentId: [
    param('assignmentId')
      .isInt({ min: 1 }).withMessage('Assignment ID must be a positive integer')
      .custom(async (assignmentId) => {
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
          throw new Error('Assignment not found');
        }
        return true;
      })
  ],

  // Assignment query parameters validation
  validateAssignmentQuery: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer')
      .default(1),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
      .default(10),
    
    query('course_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid course ID'),
    
    query('status')
      .optional()
      .isIn(Object.values(ASSIGNMENT_STATUS)).withMessage('Invalid assignment status'),
    
    query('instructor_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid instructor ID'),
    
    query('search')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Search term must be between 2 and 100 characters')
      .trim(),
    
    query('sort')
      .optional()
      .isIn(['title', 'due_date', 'created_at', 'total_points']).withMessage('Invalid sort field'),
    
    query('order')
      .optional()
      .isIn(['asc', 'desc']).withMessage('Order must be either asc or desc')
  ],

  // Assignment submission validation
  validateSubmission: [
    body('assignment_id')
      .isInt({ min: 1 }).withMessage('Please select a valid assignment')
      .custom(async (assignmentId, { req }) => {
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
          throw new Error('Assignment not found');
        }
        
        // Check if assignment is still open
        if (assignment.status !== 'published') {
          throw new Error('This assignment is not available for submission');
        }
        
        // Check if due date has passed
        const now = new Date();
        const dueDate = new Date(assignment.due_date);
        if (now > dueDate) {
          throw new Error('Assignment due date has passed');
        }
        
        return true;
      }),
    
    body('content')
      .optional()
      .trim()
      .isLength({ max: 5000 }).withMessage('Submission content must not exceed 5000 characters'),
    
    body('file_path')
      .optional()
      .isLength({ max: 500 }).withMessage('File path is too long'),
    
    body('file_name')
      .optional()
      .isLength({ max: 255 }).withMessage('File name is too long'),
    
    body('file_size')
      .optional()
      .isInt({ min: 1 }).withMessage('File size must be a positive integer'),
    
    body('submission_notes')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Submission notes must not exceed 1000 characters')
  ],

  // Grade assignment validation
  validateGrading: [
    body('submission_id')
      .isInt({ min: 1 }).withMessage('Please select a valid submission'),
    
    body('score')
      .isFloat({ min: 0 }).withMessage('Score must be a positive number')
      .custom((value, { req }) => {
        // Get assignment to check max points
        // This would typically be done in the controller
        if (value > req.body.max_points) {
          throw new Error(`Score cannot exceed maximum points (${req.body.max_points})`);
        }
        return true;
      }),
    
    body('grade')
      .optional()
      .isIn(['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F']).withMessage('Invalid grade'),
    
    body('feedback')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('Feedback must not exceed 2000 characters'),
    
    body('graded_by')
      .isInt({ min: 1 }).withMessage('Invalid grader ID')
  ],

  // Bulk grading validation
  validateBulkGrading: [
    body('grades')
      .isArray({ min: 1 }).withMessage('Grades array is required and cannot be empty')
      .custom((grades) => {
        if (grades.length > 100) {
          throw new Error('Cannot grade more than 100 submissions at once');
        }
        return true;
      }),
    
    body('grades.*.submission_id')
      .isInt({ min: 1 }).withMessage('Invalid submission ID'),
    
    body('grades.*.score')
      .isFloat({ min: 0 }).withMessage('Score must be a positive number'),
    
    body('grades.*.feedback')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Feedback must not exceed 1000 characters')
  ],

  // Assignment extension validation
  validateExtension: [
    body('student_id')
      .isInt({ min: 1 }).withMessage('Please select a valid student'),
    
    body('assignment_id')
      .isInt({ min: 1 }).withMessage('Please select a valid assignment'),
    
    body('new_due_date')
      .isISO8601().withMessage('Please provide a valid new due date')
      .custom((value, { req }) => {
        const newDueDate = new Date(value);
        const now = new Date();
        
        if (newDueDate <= now) {
          throw new Error('New due date must be in the future');
        }
        
        return true;
      }),
    
    body('reason')
      .trim()
      .notEmpty().withMessage('Reason for extension is required')
      .isLength({ max: 500 }).withMessage('Reason must not exceed 500 characters')
  ],

  // Assignment plagiarism check validation
  validatePlagiarismCheck: [
    param('assignmentId')
      .isInt({ min: 1 }).withMessage('Assignment ID must be a positive integer'),
    
    query('similarity_threshold')
      .optional()
      .isFloat({ min: 0, max: 100 }).withMessage('Similarity threshold must be between 0 and 100')
      .default(25),
    
    query('min_word_count')
      .optional()
      .isInt({ min: 10 }).withMessage('Minimum word count must be at least 10')
      .default(50)
  ],

  // Assignment statistics validation
  validateStatisticsQuery: [
    param('assignmentId')
      .isInt({ min: 1 }).withMessage('Assignment ID must be a positive integer'),
    
    query('include_submissions')
      .optional()
      .isBoolean().withMessage('include_submissions must be a boolean value'),
    
    query('include_grades')
      .optional()
      .isBoolean().withMessage('include_grades must be a boolean value')
  ]
};

module.exports = assignmentValidators;