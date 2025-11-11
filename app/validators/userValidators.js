const { body, param, query } = require('express-validator');
const User = require('../models/User');
const Student = require('../models/Student');
const Instructor = require('../models/Instructor');
const { ROLES } = require('../../config/constants');

const userValidators = {
  // User registration validation
  validateRegistration: [
    body('first_name')
      .trim()
      .notEmpty().withMessage('First name is required')
      .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s\-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
    
    body('last_name')
      .trim()
      .notEmpty().withMessage('Last name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s\-']+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
    
    body('email')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail()
      .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters')
      .custom(async (email) => {
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
          throw new Error('Email is already registered');
        }
        return true;
      }),
    
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    
    body('confirm_password')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    
    body('phone')
      .optional()
      .matches(/^(?:254|\+254|0)?[17]\d{8}$/).withMessage('Please provide a valid Kenyan phone number'),
    
    body('role_id')
      .isInt({ min: 1 }).withMessage('Please select a valid role')
      .custom(async (roleId) => {
        // Check if role exists (you might want to query the roles table)
        const validRoles = [2, 3, 4]; // Assuming these are valid role IDs
        if (!validRoles.includes(parseInt(roleId))) {
          throw new Error('Invalid role selected');
        }
        return true;
      }),
    
    body('date_of_birth')
      .optional()
      .isDate().withMessage('Please provide a valid date of birth')
      .custom((value) => {
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        if (age < 16) {
          throw new Error('You must be at least 16 years old to register');
        }
        return true;
      }),
    
    body('gender')
      .optional()
      .isIn(['male', 'female', 'other']).withMessage('Please select a valid gender')
  ],

  // Student-specific registration validation
  validateStudentRegistration: [
    body('student_id')
      .optional()
      .matches(/^STU[A-Z0-9]{6,10}$/).withMessage('Please provide a valid student ID format')
      .custom(async (studentId) => {
        if (studentId) {
          const existingStudent = await Student.findByStudentId(studentId);
          if (existingStudent) {
            throw new Error('Student ID already exists');
          }
        }
        return true;
      }),
    
    body('program')
      .notEmpty().withMessage('Program is required for students')
      .isLength({ min: 2, max: 100 }).withMessage('Program must be between 2 and 100 characters'),
    
    body('semester')
      .isIn(['spring', 'summer', 'fall', 'winter']).withMessage('Please select a valid semester'),
    
    body('year')
      .isInt({ min: 1, max: 6 }).withMessage('Year must be between 1 and 6'),
    
    body('parent_name')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Parent name must be between 2 and 100 characters'),
    
    body('parent_phone')
      .optional()
      .matches(/^(?:254|\+254|0)?[17]\d{8}$/).withMessage('Please provide a valid parent phone number'),
    
    body('emergency_contact')
      .optional()
      .isLength({ min: 5, max: 255 }).withMessage('Emergency contact must be between 5 and 255 characters')
  ],

  // Instructor-specific registration validation
  validateInstructorRegistration: [
    body('employee_id')
      .optional()
      .matches(/^EMP[A-Z0-9]{6,10}$/).withMessage('Please provide a valid employee ID format')
      .custom(async (employeeId) => {
        if (employeeId) {
          // Check if employee ID exists (you might need to create a method for this)
          const existingInstructor = await Instructor.findByEmployeeId(employeeId);
          if (existingInstructor) {
            throw new Error('Employee ID already exists');
          }
        }
        return true;
      }),
    
    body('department')
      .notEmpty().withMessage('Department is required for instructors')
      .isLength({ min: 2, max: 100 }).withMessage('Department must be between 2 and 100 characters'),
    
    body('qualification')
      .notEmpty().withMessage('Qualification is required for instructors')
      .isLength({ min: 2, max: 100 }).withMessage('Qualification must be between 2 and 100 characters'),
    
    body('specialization')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Specialization must be between 2 and 100 characters'),
    
    body('office_location')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Office location must be between 2 and 100 characters'),
    
    body('office_hours')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Office hours must be between 2 and 100 characters')
  ],

  // User login validation
  validateLogin: [
    body('email')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
    
    body('password')
      .notEmpty().withMessage('Password is required')
  ],

  // User profile update validation
  validateProfileUpdate: [
    body('first_name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s\-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
    
    body('last_name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s\-']+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
    
    body('phone')
      .optional()
      .matches(/^(?:254|\+254|0)?[17]\d{8}$/).withMessage('Please provide a valid Kenyan phone number'),
    
    body('address')
      .optional()
      .isLength({ min: 5, max: 500 }).withMessage('Address must be between 5 and 500 characters'),
    
    body('date_of_birth')
      .optional()
      .isDate().withMessage('Please provide a valid date of birth'),
    
    body('gender')
      .optional()
      .isIn(['male', 'female', 'other']).withMessage('Please select a valid gender')
  ],

  // Password change validation
  validatePasswordChange: [
    body('current_password')
      .notEmpty().withMessage('Current password is required'),
    
    body('new_password')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    
    body('confirm_password')
      .custom((value, { req }) => {
        if (value !== req.body.new_password) {
          throw new Error('Passwords do not match');
        }
        return true;
      })
  ],

  // User ID parameter validation
  validateUserId: [
    param('id')
      .isInt({ min: 1 }).withMessage('User ID must be a positive integer')
      .custom(async (id, { req }) => {
        const user = await User.findById(id);
        if (!user) {
          throw new Error('User not found');
        }
        return true;
      })
  ],

  // User query parameters validation
  validateUserQuery: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer')
      .default(1),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
      .default(10),
    
    query('role')
      .optional()
      .isIn(Object.values(ROLES)).withMessage('Invalid role specified'),
    
    query('search')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Search term must be between 2 and 100 characters')
      .trim()
  ],

  // Bulk user import validation
  validateBulkImport: [
    body('users')
      .isArray({ min: 1 }).withMessage('Users array is required and cannot be empty')
      .custom((users) => {
        if (users.length > 100) {
          throw new Error('Cannot import more than 100 users at once');
        }
        return true;
      }),
    
    body('users.*.first_name')
      .notEmpty().withMessage('First name is required for all users')
      .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
    
    body('users.*.last_name')
      .notEmpty().withMessage('Last name is required for all users')
      .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
    
    body('users.*.email')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    
    body('users.*.role_id')
      .isInt({ min: 1 }).withMessage('Invalid role ID'),
    
    body('users.*.phone')
      .optional()
      .matches(/^(?:254|\+254|0)?[17]\d{8}$/).withMessage('Invalid phone number format')
  ],

  // Email validation for forgot password
  validateForgotPassword: [
    body('email')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail()
  ],

  // Reset password validation
  validateResetPassword: [
    body('token')
      .notEmpty().withMessage('Reset token is required'),
    
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    
    body('confirm_password')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      })
  ],

  // User status update validation
  validateStatusUpdate: [
    body('is_active')
      .isBoolean().withMessage('is_active must be a boolean value'),
    
    body('reason')
      .optional()
      .isLength({ min: 5, max: 500 }).withMessage('Reason must be between 5 and 500 characters')
  ],

  // User role update validation
  validateRoleUpdate: [
    body('role_id')
      .isInt({ min: 1 }).withMessage('Please select a valid role')
      .custom(async (roleId, { req }) => {
        // Prevent users from changing their own role to admin
        if (parseInt(roleId) === 1 && req.user.id === parseInt(req.params.id)) {
          throw new Error('You cannot change your own role to administrator');
        }
        return true;
      })
  ]
};

module.exports = userValidators;