const express = require('express');
const router = express.Router();
const financeController = require('../controllers/users/financeController');
const { isAuthenticated, hasAnyRole } = require('../middleware/auth');

// Apply authentication and role middleware to all finance routes
router.use(isAuthenticated);
router.use(hasAnyRole(['admin', 'finance_officer']));

// Dashboard
router.get('/dashboard', financeController.dashboard);

// Payment routes
router.get('/payments/records', financeController.paymentRecords);
router.get('/payments/pending', financeController.pendingPayments);
router.get('/payments/verified', financeController.verifiedPayments);
router.get('/payments/reconciliation', financeController.paymentReconciliation);
router.get('/payments/manual-entry', financeController.showManualPayment);
router.post('/payments/manual-entry', financeController.processManualPayment);
router.post('/payments/verify/:id', financeController.verifyPayment);
router.post('/payments/bulk-verify', financeController.bulkVerifyPayments);

// Fee structure routes
router.get('/fees', financeController.feeStructures);
router.get('/fees/create', financeController.showCreateFee);
router.post('/fees/create', financeController.createFee);
router.get('/fees/edit/:id', financeController.showEditFee);
router.post('/fees/edit/:id', financeController.updateFee);
router.post('/fees/delete/:id', financeController.deleteFee);

// Student routes
router.get('/students/fee-statements', financeController.studentFeeStatements);
router.get('/students/outstanding', financeController.outstandingFees);
router.get('/students/payment-history/:id', financeController.viewStudentPayments);

// Reports routes
router.get('/reports', financeController.showReports);
router.get('/reports/generate', financeController.generateReport);

// Profile routes
router.get('/profile', financeController.profile);

// Redirect root finance route to dashboard
router.get('/', (req, res) => {
    res.redirect('/finance/dashboard');
});

module.exports = router;