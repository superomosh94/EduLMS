const { body, param, query } = require('express-validator');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const { PAYMENT_STATUS, FEE_TYPES } = require('../../config/constants');

const paymentValidators = {
  // Payment initiation validation
  validatePaymentInitiation: [
    body('student_id')
      .isInt({ min: 1 }).withMessage('Please select a valid student')
      .custom(async (studentId) => {
        const student = await Student.findByUserId(studentId);
        if (!student) {
          throw new Error('Student not found');
        }
        return true;
      }),
    
    body('amount')
      .isFloat({ min: 1, max: 1000000 }).withMessage('Amount must be between 1 and 1,000,000 KES'),
    
    body('fee_type')
      .isIn(Object.values(FEE_TYPES)).withMessage('Invalid fee type'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
    
    body('academic_year')
      .optional()
      .matches(/^\d{4}-\d{4}$/).withMessage('Academic year must be in format YYYY-YYYY'),
    
    body('semester')
      .optional()
      .isIn(['spring', 'summer', 'fall', 'winter']).withMessage('Invalid semester')
  ],

  // M-Pesa payment validation
  validateMpesaPayment: [
    body('phone')
      .notEmpty().withMessage('Phone number is required')
      .matches(/^(?:254|\+254|0)?[17]\d{8}$/).withMessage('Please provide a valid Kenyan phone number'),
    
    body('amount')
      .isFloat({ min: 1, max: 150000 }).withMessage('Amount must be between 1 and 150,000 KES'),
    
    body('payment_id')
      .isInt({ min: 1 }).withMessage('Invalid payment ID')
      .custom(async (paymentId) => {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
          throw new Error('Payment not found');
        }
        if (payment.status !== 'pending') {
          throw new Error('Payment has already been processed');
        }
        return true;
      })
  ],

  // Payment verification validation
  validatePaymentVerification: [
    body('payment_id')
      .isInt({ min: 1 }).withMessage('Invalid payment ID'),
    
    body('mpesa_receipt')
      .notEmpty().withMessage('M-Pesa receipt number is required')
      .matches(/^[A-Z0-9]{10}$/).withMessage('Invalid M-Pesa receipt number format'),
    
    body('transaction_date')
      .isISO8601().withMessage('Please provide a valid transaction date'),
    
    body('phone_number')
      .notEmpty().withMessage('Phone number is required')
      .matches(/^(?:254|\+254|0)?[17]\d{8}$/).withMessage('Please provide a valid Kenyan phone number')
  ],

  // Payment status update validation
  validatePaymentStatusUpdate: [
    body('payment_id')
      .isInt({ min: 1 }).withMessage('Invalid payment ID'),
    
    body('status')
      .isIn(Object.values(PAYMENT_STATUS)).withMessage('Invalid payment status'),
    
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Reason must not exceed 500 characters')
      .custom((value, { req }) => {
        if (req.body.status === 'failed' || req.body.status === 'cancelled') {
          if (!value || value.trim().length === 0) {
            throw new Error('Reason is required for failed or cancelled payments');
          }
        }
        return true;
      })
  ],

  // Payment ID parameter validation
  validatePaymentId: [
    param('paymentId')
      .isInt({ min: 1 }).withMessage('Payment ID must be a positive integer')
      .custom(async (paymentId) => {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
          throw new Error('Payment not found');
        }
        return true;
      })
  ],

  // Payment query parameters validation
  validatePaymentQuery: [
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
    
    query('status')
      .optional()
      .isIn(Object.values(PAYMENT_STATUS)).withMessage('Invalid payment status'),
    
    query('fee_type')
      .optional()
      .isIn(Object.values(FEE_TYPES)).withMessage('Invalid fee type'),
    
    query('start_date')
      .optional()
      .isDate().withMessage('Start date must be a valid date'),
    
    query('end_date')
      .optional()
      .isDate().withMessage('End date must be a valid date')
      .custom((value, { req }) => {
        if (req.query.start_date && new Date(value) < new Date(req.query.start_date)) {
          throw new Error('End date cannot be before start date');
        }
        return true;
      }),
    
    query('min_amount')
      .optional()
      .isFloat({ min: 0 }).withMessage('Minimum amount must be a positive number'),
    
    query('max_amount')
      .optional()
      .isFloat({ min: 0 }).withMessage('Maximum amount must be a positive number')
      .custom((value, { req }) => {
        if (req.query.min_amount && parseFloat(value) < parseFloat(req.query.min_amount)) {
          throw new Error('Maximum amount cannot be less than minimum amount');
        }
        return true;
      })
  ],

  // Fee structure validation
  validateFeeStructure: [
    body('name')
      .trim()
      .notEmpty().withMessage('Fee structure name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
    
    body('fee_type')
      .isIn(Object.values(FEE_TYPES)).withMessage('Invalid fee type'),
    
    body('amount')
      .isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    
    body('academic_year')
      .matches(/^\d{4}-\d{4}$/).withMessage('Academic year must be in format YYYY-YYYY'),
    
    body('semester')
      .isIn(['spring', 'summer', 'fall', 'winter']).withMessage('Invalid semester'),
    
    body('program')
      .optional()
      .isLength({ max: 100 }).withMessage('Program must not exceed 100 characters'),
    
    body('year')
      .optional()
      .isInt({ min: 1, max: 6 }).withMessage('Year must be between 1 and 6'),
    
    body('due_date')
      .optional()
      .isDate().withMessage('Due date must be a valid date'),
    
    body('is_active')
      .optional()
      .isBoolean().withMessage('is_active must be a boolean value')
  ],

  // Invoice generation validation
  validateInvoiceGeneration: [
    body('student_id')
      .isInt({ min: 1 }).withMessage('Please select a valid student'),
    
    body('fee_items')
      .isArray({ min: 1 }).withMessage('At least one fee item is required')
      .custom((items) => {
        if (items.length > 20) {
          throw new Error('Cannot add more than 20 fee items');
        }
        return true;
      }),
    
    body('fee_items.*.description')
      .trim()
      .notEmpty().withMessage('Fee item description is required')
      .isLength({ max: 200 }).withMessage('Description must not exceed 200 characters'),
    
    body('fee_items.*.amount')
      .isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    
    body('fee_items.*.quantity')
      .optional()
      .isInt({ min: 1 }).withMessage('Quantity must be at least 1')
      .default(1),
    
    body('due_date')
      .optional()
      .isDate().withMessage('Due date must be a valid date'),
    
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Notes must not exceed 1000 characters')
  ],

  // Refund validation
  validateRefund: [
    body('payment_id')
      .isInt({ min: 1 }).withMessage('Invalid payment ID')
      .custom(async (paymentId) => {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
          throw new Error('Payment not found');
        }
        if (payment.status !== 'completed') {
          throw new Error('Only completed payments can be refunded');
        }
        return true;
      }),
    
    body('refund_amount')
      .isFloat({ min: 1 }).withMessage('Refund amount must be a positive number')
      .custom((value, { req }) => {
        // This would typically check against the original payment amount
        if (value > req.body.original_amount) {
          throw new Error('Refund amount cannot exceed original payment amount');
        }
        return true;
      }),
    
    body('reason')
      .trim()
      .notEmpty().withMessage('Refund reason is required')
      .isLength({ max: 500 }).withMessage('Reason must not exceed 500 characters'),
    
    body('refund_method')
      .isIn(['mpesa', 'bank_transfer', 'cash', 'credit_note']).withMessage('Invalid refund method')
  ],

  // Payment reconciliation validation
  validateReconciliation: [
    body('start_date')
      .isDate().withMessage('Start date is required'),
    
    body('end_date')
      .isDate().withMessage('End date is required')
      .custom((value, { req }) => {
        if (new Date(value) < new Date(req.body.start_date)) {
          throw new Error('End date cannot be before start date');
        }
        
        const start = new Date(req.body.start_date);
        const end = new Date(value);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 31) {
          throw new Error('Reconciliation period cannot exceed 31 days');
        }
        
        return true;
      }),
    
    body('payment_method')
      .optional()
      .isIn(['mpesa', 'cash', 'bank_transfer', 'card']).withMessage('Invalid payment method')
  ],

  // Bulk payment processing validation
  validateBulkPayments: [
    body('payments')
      .isArray({ min: 1 }).withMessage('Payments array is required and cannot be empty')
      .custom((payments) => {
        if (payments.length > 50) {
          throw new Error('Cannot process more than 50 payments at once');
        }
        return true;
      }),
    
    body('payments.*.student_id')
      .isInt({ min: 1 }).withMessage('Invalid student ID'),
    
    body('payments.*.amount')
      .isFloat({ min: 1 }).withMessage('Amount must be a positive number'),
    
    body('payments.*.fee_type')
      .isIn(Object.values(FEE_TYPES)).withMessage('Invalid fee type'),
    
    body('payments.*.description')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Description must not exceed 200 characters')
  ],

  // Payment statistics validation
  validatePaymentStatistics: [
    query('period')
      .optional()
      .isIn(['today', 'week', 'month', 'quarter', 'year', 'custom']).withMessage('Invalid period'),
    
    query('start_date')
      .optional()
      .isDate().withMessage('Start date must be a valid date'),
    
    query('end_date')
      .optional()
      .isDate().withMessage('End date must be a valid date')
      .custom((value, { req }) => {
        if (req.query.start_date && new Date(value) < new Date(req.query.start_date)) {
          throw new Error('End date cannot be before start date');
        }
        return true;
      }),
    
    query('group_by')
      .optional()
      .isIn(['day', 'week', 'month', 'fee_type', 'status']).withMessage('Invalid group by value')
  ]
};

module.exports = paymentValidators;