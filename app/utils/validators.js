const { body, validationResult } = require('express-validator');

// Common validation rules
const userValidationRules = () => {
    return [
        body('firstName')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('First name must be between 2 and 50 characters')
            .isAlpha('en-US', { ignore: ' -' })
            .withMessage('First name can only contain letters, spaces, and hyphens'),
        
        body('lastName')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Last name must be between 2 and 50 characters')
            .isAlpha('en-US', { ignore: ' -' })
            .withMessage('Last name can only contain letters, spaces, and hyphens'),
        
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email address'),
        
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    ];
};

const loginValidationRules = () => {
    return [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email address'),
        
        body('password')
            .notEmpty()
            .withMessage('Password is required')
    ];
};

const courseValidationRules = () => {
    return [
        body('courseCode')
            .trim()
            .isLength({ min: 3, max: 20 })
            .withMessage('Course code must be between 3 and 20 characters')
            .matches(/^[A-Z0-9-]+$/)
            .withMessage('Course code can only contain uppercase letters, numbers, and hyphens'),
        
        body('courseName')
            .trim()
            .isLength({ min: 5, max: 100 })
            .withMessage('Course name must be between 5 and 100 characters'),
        
        body('credits')
            .isInt({ min: 1, max: 10 })
            .withMessage('Credits must be between 1 and 10'),
        
        body('maxStudents')
            .isInt({ min: 1, max: 500 })
            .withMessage('Maximum students must be between 1 and 500')
    ];
};

const assignmentValidationRules = () => {
    return [
        body('title')
            .trim()
            .isLength({ min: 5, max: 200 })
            .withMessage('Title must be between 5 and 200 characters'),
        
        body('description')
            .optional()
            .trim()
            .isLength({ max: 1000 })
            .withMessage('Description cannot exceed 1000 characters'),
        
        body('maxPoints')
            .isFloat({ min: 0, max: 1000 })
            .withMessage('Maximum points must be between 0 and 1000'),
        
        body('dueDate')
            .isISO8601()
            .withMessage('Due date must be a valid date')
            .custom((value) => {
                if (new Date(value) <= new Date()) {
                    throw new Error('Due date must be in the future');
                }
                return true;
            })
    ];
};

const paymentValidationRules = () => {
    return [
        body('amount')
            .isFloat({ min: 1 })
            .withMessage('Amount must be at least 1'),
        
        body('phoneNumber')
            .matches(/^(\+?254|0)?[17]\d{8}$/)
            .withMessage('Please provide a valid Kenyan phone number'),
        
        body('studentId')
            .notEmpty()
            .withMessage('Student ID is required')
    ];
};

// Validation result middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));
    
    return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: extractedErrors
    });
};

module.exports = {
    userValidationRules,
    loginValidationRules,
    courseValidationRules,
    assignmentValidationRules,
    paymentValidationRules,
    validate
};