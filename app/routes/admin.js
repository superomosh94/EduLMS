const express = require('express');
const router = express.Router();

// Import controllers and middleware
const adminController = require('../controllers/users/adminController');
const { ensureAuthenticated, requireAdmin } = require('../middleware/auth');
const { validateUserUpdate, validateCourse, validateFeeStructure } = require('../middleware/validation');

// Apply admin middleware to all routes
router.use(ensureAuthenticated, requireAdmin);

// Dashboard
router.get('/dashboard', adminController.dashboard);

// User management
router.get('/users', adminController.listUsers);
router.get('/users/create', adminController.showCreateUser);
router.post('/users/create', adminController.createUser);
router.get('/users/edit/:id', adminController.showEditUser);
router.post('/users/edit/:id', validateUserUpdate, adminController.updateUser);
router.get('/users/view/:id', adminController.viewUser);
router.post('/users/delete/:id', adminController.deleteUser);
router.post('/users/bulk-operation', adminController.bulkUserOperation);

// Financial management
router.get('/finance/overview', adminController.financialOverview);

// Academic overview
router.get('/academic/overview', adminController.academicOverview);

// System management
router.get('/system/settings', adminController.systemSettings);
router.post('/system/settings/update', adminController.updateSystemSettings);
router.get('/system/audit-logs', adminController.auditLogs);
router.post('/system/maintenance', adminController.runMaintenance);
router.get('/system/export', adminController.exportData);

module.exports = router;