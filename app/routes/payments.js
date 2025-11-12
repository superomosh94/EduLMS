const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/finance/paymentController');
const { isAuthenticated, hasAnyRole } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Payment processing routes
router.post('/process-mpesa', paymentController.processMpesaPayment);

// M-Pesa callback (public route for M-Pesa to call)
router.post('/mpesa-callback', paymentController.handleMpesaCallback);

// Payment history and management
router.get('/history', paymentController.getPaymentHistory);

router.get('/stats', 
  hasAnyRole(['admin', 'finance_officer']), 
  paymentController.getPaymentStats
);

router.get('/:paymentId/verify', 
  hasAnyRole(['admin', 'finance_officer']), 
  paymentController.verifyPayment
);

router.get('/:paymentId/receipt', paymentController.generateReceipt);

// Get specific payment
router.get('/:id', paymentController.getPaymentById);

// Student-specific routes
router.get('/my-payments', 
  hasAnyRole(['student']), 
  paymentController.getMyPayments
);

module.exports = router;