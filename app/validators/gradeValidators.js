const { body, param, query } = require('express-validator');
const Grade = require('../models/Grade');
const Assignment = require('../models/Assignment');
const { GRADE_POINTS } = require('../../config/constants');

const gradeValidators = {
  // Grade entry validation
  validateGradeEntry: [
    body('student_id')
      .isInt({ min: 1 }).withMessage('Please select a valid student'),
    
    body('assignment_id')
      .isInt({ min: 1 }).withMessage('Please select a valid assignment')
      .custom(async (assignmentId) => {
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
          throw new Error('Assignment not found');
        }
        return true;
      }),
    
    body('score')
      .isFloat({ min: 0 }).withMessage('Score must be a positive number')
      .custom(async (value, { req }) => {
        const assignment = await Assignment.findById(req.body.assignment_id);
        if (value > assignment.total_points) {
          throw new Error(`Score cannot exceed assignment maximum points (${assignment.total_points})`);
        }
        return true;
      }),
    
    body('grade')
      .optional()
      .isIn(Object.keys(GRADE_POINTS)).withMessage('Invalid grade')
      .custom((value, { req }) => {
        // Auto-calculate grade if not provided
        if (!value && req.body.score !== undefined) {
          const percentage = (req.body.score / req.body.max_points) * 100;
          // Grade calculation logic would go here
          return true;
        }
        return true;
      }),
    
    body('feedback')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('Feedback must not exceed 2000 characters'),
    
    body('graded_by')
      .isInt({ min: 1 }).withMessage('Invalid grader ID'),
    
    body('is_final')
      .optional()
      .isBoolean().withMessage('is_final must be a boolean value')
  ],

  // Grade update validation
  validateGradeUpdate: [
    body('score')
      .optional()
      .isFloat({ min: 0 }).withMessage('Score must be a positive number'),
    
    body('grade')
      .optional()
      .isIn(Object.keys(GRADE_POINTS)).withMessage('Invalid grade'),
    
    body('feedback')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('Feedback must not exceed 2000 characters'),
    
    body('is_final')
      .optional()
      .isBoolean().withMessage('is_final must be a boolean value'),
    
    body('regrade_reason')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Regrade reason must not exceed 500 characters')
      .custom((value, { req }) => {
        if (req.body.regrade_requested && (!value || value.trim().length === 0)) {
          throw new Error('Regrade reason is required when requesting a regrade');
        }
        return true;
      })
  ],

  // Bulk grade entry validation
  validateBulkGradeEntry: [
    body('assignment_id')
      .isInt({ min: 1 }).withMessage('Please select a valid assignment'),
    
    body('grades')
      .isArray({ min: 1 }).withMessage('Grades array is required and cannot be empty')
      .custom(async (grades, { req }) => {
        if (grades.length > 100) {
          throw new Error('Cannot grade more than 100 students at once');
        }
        
        // Check assignment max points
        const assignment = await Assignment.findById(req.body.assignment_id);
        if (!assignment) {
          throw new Error('Assignment not found');
        }
        
        for (const grade of grades) {
          if (grade.score > assignment.total_points) {
            throw new Error(`Score for student ${grade.student_id} exceeds assignment maximum points`);
          }
        }
        
        return true;
      }),
    
    body('grades.*.student_id')
      .isInt({ min: 1 }).withMessage('Invalid student ID'),
    
    body('grades.*.score')
      .isFloat({ min: 0 }).withMessage('Score must be a positive number'),
    
    body('grades.*.feedback')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Feedback must not exceed 500 characters')
  ],

  // Grade ID parameter validation
  validateGradeId: [
    param('gradeId')
      .isInt({ min: 1 }).withMessage('Grade ID must be a positive integer')
      .custom(async (gradeId) => {
        const grade = await Grade.findById(gradeId);
        if (!grade) {
          throw new Error('Grade not found');
        }
        return true;
      })
  ],

  // Grade query parameters validation
  validateGradeQuery: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer')
      .default(1),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
      .default(20),
    
    query('student_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid student ID'),
    
    query('course_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid course ID'),
    
    query('assignment_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid assignment ID'),
    
    query('is_final')
      .optional()
      .isBoolean().withMessage('is_final must be a boolean value'),
    
    query('min_score')
      .optional()
      .isFloat({ min: 0 }).withMessage('Minimum score must be a positive number'),
    
    query('max_score')
      .optional()
      .isFloat({ min: 0 }).withMessage('Maximum score must be a positive number')
      .custom((value, { req }) => {
        if (req.query.min_score && parseFloat(value) < parseFloat(req.query.min_score)) {
          throw new Error('Maximum score cannot be less than minimum score');
        }
        return true;
      }),
    
    query('grade')
      .optional()
      .isIn(Object.keys(GRADE_POINTS)).withMessage('Invalid grade'),
    
    query('sort')
      .optional()
      .isIn(['student_id', 'score', 'grade', 'created_at']).withMessage('Invalid sort field'),
    
    query('order')
      .optional()
      .isIn(['asc', 'desc']).withMessage('Order must be either asc or desc')
  ],

  // Grade calculation validation
  validateGradeCalculation: [
    body('student_id')
      .isInt({ min: 1 }).withMessage('Please select a valid student'),
    
    body('course_id')
      .isInt({ min: 1 }).withMessage('Please select a valid course'),
    
    body('component_weights')
      .optional()
      .isObject().withMessage('Component weights must be an object')
      .custom((weights) => {
        const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
          throw new Error('Component weights must sum to 100%');
        }
        return true;
      }),
    
    body('include_pending')
      .optional()
      .isBoolean().withMessage('include_pending must be a boolean value')
      .default(false)
  ],

  // Grade distribution validation
  validateGradeDistribution: [
    param('courseId')
      .isInt({ min: 1 }).withMessage('Course ID must be a positive integer'),
    
    query('assignment_type')
      .optional()
      .isIn(['exam', 'quiz', 'assignment', 'project', 'participation']).withMessage('Invalid assignment type'),
    
    query('include_drafts')
      .optional()
      .isBoolean().withMessage('include_drafts must be a boolean value')
      .default(false)
  ],

  // Grade appeal validation
  validateGradeAppeal: [
    body('grade_id')
      .isInt({ min: 1 }).withMessage('Invalid grade ID'),
    
    body('reason')
      .trim()
      .notEmpty().withMessage('Appeal reason is required')
      .isLength({ min: 10, max: 1000 }).withMessage('Appeal reason must be between 10 and 1000 characters'),
    
    body('expected_grade')
      .optional()
      .isIn(Object.keys(GRADE_POINTS)).withMessage('Invalid expected grade'),
    
    body('supporting_evidence')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('Supporting evidence must not exceed 2000 characters')
  ],

  // Gradebook validation
  validateGradebook: [
    param('courseId')
      .isInt({ min: 1 }).withMessage('Course ID must be a positive integer'),
    
    query('include_students')
      .optional()
      .isBoolean().withMessage('include_students must be a boolean value')
      .default(true),
    
    query('include_assignments')
      .optional()
      .isBoolean().withMessage('include_assignments must be a boolean value')
      .default(true),
    
    query('export_format')
      .optional()
      .isIn(['json', 'csv', 'pdf', 'excel']).withMessage('Invalid export format')
  ],

  // Transcript generation validation
  validateTranscript: [
    body('student_id')
      .isInt({ min: 1 }).withMessage('Please select a valid student'),
    
    body('include_in_progress')
      .optional()
      .isBoolean().withMessage('include_in_progress must be a boolean value')
      .default(false),
    
    body('include_details')
      .optional()
      .isBoolean().withMessage('include_details must be a boolean value')
      .default(true),
    
    body('format')
      .optional()
      .isIn(['official', 'unofficial']).withMessage('Invalid transcript format')
      .default('official')
  ],

  // Grade statistics validation
  validateGradeStatistics: [
    query('course_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid course ID'),
    
    query('instructor_id')
      .optional()
      .isInt({ min: 1 }).withMessage('Invalid instructor ID'),
    
    query('academic_year')
      .optional()
      .matches(/^\d{4}-\d{4}$/).withMessage('Academic year must be in format YYYY-YYYY'),
    
    query('semester')
      .optional()
      .isIn(['spring', 'summer', 'fall', 'winter']).withMessage('Invalid semester'),
    
    query('group_by')
      .optional()
      .isIn(['course', 'instructor', 'assignment_type', 'grade']).withMessage('Invalid group by value')
  ],

  // Grade import validation
  validateGradeImport: [
    body('course_id')
      .isInt({ min: 1 }).withMessage('Please select a valid course'),
    
    body('assignment_id')
      .isInt({ min: 1 }).withMessage('Please select a valid assignment'),
    
    body('grades_data')
      .isArray({ min: 1 }).withMessage('Grades data is required and cannot be empty')
      .custom((data) => {
        if (data.length > 200) {
          throw new Error('Cannot import more than 200 grades at once');
        }
        return true;
      }),
    
    body('grades_data.*.student_id')
      .isInt({ min: 1 }).withMessage('Invalid student ID'),
    
    body('grades_data.*.score')
      .isFloat({ min: 0 }).withMessage('Score must be a positive number'),
    
    body('overwrite_existing')
      .optional()
      .isBoolean().withMessage('overwrite_existing must be a boolean value')
      .default(false)
  ]
};

module.exports = gradeValidators;