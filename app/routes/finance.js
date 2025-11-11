const express = require('express');
const router = express.Router();
const { isFinanceOfficer, isAuthenticated } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const financeController = require('../controllers/users/financeController');
const { validatePaymentQuery, validatePaymentId, validateFeeStructure, validateInvoiceGeneration } = require('../validators/paymentValidators');

// Apply finance officer middleware to all routes
router.use(isAuthenticated);
router.use(isFinanceOfficer);

// Finance Dashboard
router.get('/dashboard', financeController.dashboard);

// Payment Management
router.get('/payments/overview', financeController.paymentsOverview);
router.get('/payments/records', validatePaymentQuery, financeController.paymentRecords);
router.get('/payments/pending', financeController.pendingPayments);
router.get('/payments/verified', financeController.verifiedPayments);
router.get('/payments/reconciliation', financeController.paymentReconciliation);
router.post('/payments/:paymentId/verify', validatePaymentId, financeController.verifyPayment);
router.post('/payments/:paymentId/cancel', validatePaymentId, financeController.cancelPayment);
router.post('/payments/bulk-verify', financeController.bulkVerifyPayments);

// Invoice Management
router.get('/invoices/generate', financeController.showGenerateInvoice);
router.post('/invoices/generate', validateInvoiceGeneration, financeController.generateInvoice);
router.get('/invoices/history', financeController.invoiceHistory);
router.get('/invoices/:invoiceId', financeController.viewInvoice);
router.post('/invoices/send', financeController.sendInvoice);
router.get('/invoices/:invoiceId/download', financeController.downloadInvoice);

// Fee Structure Management
router.get('/fees/structure', financeController.feeStructure);
router.get('/fees/create', financeController.showCreateFee);
router.post('/fees/create', validateFeeStructure, financeController.createFee);
router.get('/fees/:feeId/edit', financeController.showEditFee);
router.post('/fees/:feeId/edit', financeController.updateFee);
router.post('/fees/:feeId/delete', financeController.deleteFee);
router.get('/fees/categories', financeController.feeCategories);

// Financial Reports
router.get('/reports/financial', financeController.financialReports);
router.get('/reports/revenue', financeController.revenueReports);
router.get('/reports/outstanding', financeController.outstandingFees);
router.get('/reports/collection', financeController.collectionReports);
router.get('/reports/export', financeController.exportReports);

// Student Financial Management
router.get('/students/fee-statements', financeController.studentFeeStatements);
router.get('/students/outstanding', financeController.studentsWithOutstanding);
router.get('/students/:studentId/payment-history', financeController.studentPaymentHistory);
router.get('/students/:studentId/generate-statement', financeController.generateStudentStatement);

// M-Pesa Integration
router.get('/mpesa/transactions', financeController.mpesaTransactions);
router.get('/mpesa/reconciliation', financeController.mpesaReconciliation);
router.post('/mpesa/retry-failed', financeController.retryFailedTransactions);

// Refund Management
router.get('/refunds', financeController.refundRequests);
router.post('/refunds/:refundId/process', financeController.processRefund);
router.post('/refunds/:refundId/reject', financeController.rejectRefund);

// API endpoints for finance
router.get('/api/payments/stats', financeController.getPaymentStats);
router.get('/api/revenue/trend', financeController.getRevenueTrend);
router.get('/api/students/outstanding', financeController.getOutstandingStudents);
router.get('/api/fees/summary', financeController.getFeeSummary);

// Bulk Operations
router.get('/bulk/invoicing', financeController.showBulkInvoicing);
router.post('/bulk/invoicing', financeController.processBulkInvoicing);
router.get('/bulk/payment-reminders', financeController.showPaymentReminders);
router.post('/bulk/payment-reminders', financeController.sendPaymentReminders);

// Settings and Configuration
router.get('/settings/payment-methods', financeController.paymentMethodsSettings);
router.post('/settings/payment-methods', financeController.updatePaymentMethods);
router.get('/settings/notification-templates', financeController.notificationTemplates);
router.post('/settings/notification-templates', financeController.updateNotificationTemplates);

// Export and Data Management
router.get('/export/payments', financeController.exportPayments);
router.get('/export/invoices', financeController.exportInvoices);
router.get('/export/fee-structure', financeController.exportFeeStructure);

module.exports = router;