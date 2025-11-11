const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const paymentController = require('../controllers/finance/paymentController');
const { validatePaymentInitiation, validateMpesaPayment, validatePaymentQuery, validatePaymentId } = require('../validators/paymentValidators');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Payment initiation and processing
router.get('/history', validatePaymentQuery, paymentController.getPaymentHistory);
router.get('/make-payment', paymentController.showMakePayment);
router.post('/initiate', validatePaymentInitiation, paymentController.initiatePayment);
router.post('/mpesa-payment', validateMpesaPayment, paymentController.processMpesaPayment);
router.get('/success/:paymentId', paymentController.paymentSuccess);
router.get('/failed/:paymentId', paymentController.paymentFailed);

// Invoice and receipt management
router.get('/invoices', paymentController.getInvoices);
router.get('/invoices/:invoiceId', paymentController.viewInvoice);
router.get('/invoices/:invoiceId/download', paymentController.downloadInvoice);
router.get('/receipts', paymentController.getReceipts);
router.get('/receipts/:paymentId', paymentController.viewReceipt);

// Fee management
router.get('/fee-statement', paymentController.getFeeStatement);
router.get('/outstanding-fees', paymentController.getOutstandingFees);
router.get('/fee-structure', paymentController.getFeeStructure);

// M-Pesa callback (public route for M-Pesa server)
router.post('/mpesa-callback', paymentController.handleMpesaCallback);

// Payment verification and status
router.get('/:paymentId/status', validatePaymentId, paymentController.getPaymentStatus);
router.post('/:paymentId/verify', validatePaymentId, paymentController.verifyPayment);
router.post('/:paymentId/cancel', validatePaymentId, paymentController.cancelPayment);

// Refund requests
router.get('/refunds', paymentController.getRefundRequests);
router.post('/:paymentId/request-refund', validatePaymentId, paymentController.requestRefund);

// API endpoints for payment data
router.get('/api/balance', paymentController.getFeeBalance);
router.get('/api/recent-payments', paymentController.getRecentPayments);
router.get('/api/payment-methods', paymentController.getPaymentMethods);

// Admin/Finance officer only routes
router.get('/admin/all-payments', paymentController.getAllPayments);
router.get('/admin/pending-verification', paymentController.getPendingVerification);
router.post('/admin/:paymentId/manual-verify', paymentController.manualVerifyPayment);
router.get('/admin/reports/revenue', paymentController.getRevenueReport);

// Bulk operations
router.post('/bulk/invoice-generation', paymentController.bulkGenerateInvoices);
router.post('/bulk/payment-reminders', paymentController.sendBulkPaymentReminders);

// Payment settings and preferences
router.get('/settings/payment-methods', paymentController.getPaymentSettings);
router.post('/settings/payment-methods', paymentController.updatePaymentSettings);

module.exports = router;