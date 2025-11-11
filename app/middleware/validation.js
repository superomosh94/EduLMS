const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { ROLES, FEE_TYPES } = require('../../config/constants');

// Common validation rules
const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  password: body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
    
  name: body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
    
  phone: body('phone')
    .optional({ checkFalsy: true })
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
};

// User registration validation
const validateRegistration = [
  commonValidations.name,
  commonValidations.email,
  commonValidations.password,
  body('password2')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  body('role')
    .isIn(Object.values(ROLES).filter(role => role !== ROLES.ADMIN))
    .withMessage('Invalid role selected'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({ msg: error.msg }));
      return res.render('auth/register', {
        title: 'Register - EduLMS',
        layout: 'layouts/layout',
        errors: errorMessages,
        formData: req.body,
        roles: Object.values(ROLES).filter(role => role !== ROLES.ADMIN)
      });
    }
    next();
  }
];

// User update validation
const validateUserUpdate = [
  commonValidations.name,
  commonValidations.phone,
  body('date_of_birth')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Please provide a valid date'),
  body('gender')
    .optional({ checkFalsy: true })
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender selected'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({ msg: error.msg }));
      req.flash('error_msg', errorMessages[0].msg);
      return res.redirect('back');
    }
    next();
  }
];

// Course validation
const validateCourse = [
  body('course_code')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Course code must be between 2 and 50 characters')
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage('Course code can only contain letters, numbers, hyphens, and underscores'),
  
  commonValidations.name,
  
  body('credits')
    .isInt({ min: 1, max: 10 })
    .withMessage('Credits must be between 1 and 10'),
  
  body('max_students')
    .isInt({ min: 1, max: 500 })
    .withMessage('Maximum students must be between 1 and 500'),
  
  body('fee_amount')
    .isFloat({ min: 0 })
    .withMessage('Fee amount must be a positive number'),
  
  body('start_date')
    .isISO8601()
    .withMessage('Please provide a valid start date'),
  
  body('end_date')
    .isISO8601()
    .withMessage('Please provide a valid end date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.start_date)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({ msg: error.msg }));
      
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(400).json({ errors: errorMessages });
      }
      
      req.flash('error_msg', errorMessages[0].msg);
      return res.redirect('back');
    }
    next();
  }
];

// Assignment validation
const validateAssignment = [
  commonValidations.name,
  
  body('max_points')
    .isFloat({ min: 1, max: 1000 })
    .withMessage('Maximum points must be between 1 and 1000'),
  
  body('due_date')
    .isISO8601()
    .withMessage('Please provide a valid due date')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Due date must be in the future');
      }
      return true;
    }),
  
  body('max_file_size')
    .isInt({ min: 1024, max: 104857600 }) // 1KB to 100MB
    .withMessage('Maximum file size must be between 1KB and 100MB'),
  
  body('submission_type')
    .isIn(['file', 'text', 'both'])
    .withMessage('Invalid submission type'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({ msg: error.msg }));
      
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(400).json({ errors: errorMessages });
      }
      
      req.flash('error_msg', errorMessages[0].msg);
      return res.redirect('back');
    }
    next();
  }
];

// Fee structure validation
const validateFeeStructure = [
  commonValidations.name,
  
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  
  body('fee_type')
    .isIn(Object.values(FEE_TYPES))
    .withMessage('Invalid fee type'),
  
  body('academic_year')
    .optional({ checkFalsy: true })
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Academic year must be a valid year'),
  
  body('due_date')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Please provide a valid due date'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({ msg: error.msg }));
      
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(400).json({ errors: errorMessages });
      }
      
      req.flash('error_msg', errorMessages[0].msg);
      return res.redirect('back');
    }
    next();
  }
];

// Grade validation
const validateGrade = [
  body('points_earned')
    .isFloat({ min: 0 })
    .withMessage('Points earned must be a positive number'),
  
  body('grade')
    .isLength({ min: 1, max: 5 })
    .withMessage('Grade must be between 1 and 5 characters'),
  
  body('feedback')
    .optional({ checkFalsy: true })
    .isLength({ max: 1000 })
    .withMessage('Feedback cannot exceed 1000 characters'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({ msg: error.msg }));
      
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(400).json({ errors: errorMessages });
      }
      
      req.flash('error_msg', errorMessages[0].msg);
      return res.redirect('back');
    }
    next();
  }
];

// Payment validation
const validatePayment = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least 1'),
  
  body('payment_method')
    .isIn(['mpesa', 'cash', 'bank_transfer', 'card'])
    .withMessage('Invalid payment method'),
  
  body('student_id')
    .isInt({ min: 1 })
    .withMessage('Invalid student selected'),
  
  body('fee_structure_id')
    .isInt({ min: 1 })
    .withMessage('Invalid fee structure selected'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({ msg: error.msg }));
      
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(400).json({ errors: errorMessages });
      }
      
      req.flash('error_msg', errorMessages[0].msg);
      return res.redirect('back');
    }
    next();
  }
];

// File upload validation middleware
const validateFileUpload = (fieldName, maxSize, allowedTypes) => {
  return (req, res, next) => {
    if (!req.file) {
      return next();
    }
    
    // Check file size
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: `File size must be less than ${maxSize / 1024 / 1024}MB`
      });
    }
    
    // Check file type
    if (allowedTypes && !allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
      });
    }
    
    next();
  };
};

module.exports = {
  validateRegistration,
  validateUserUpdate,
  validateCourse,
  validateAssignment,
  validateFeeStructure,
  validateGrade,
  validatePayment,
  validateFileUpload,
  commonValidations
};