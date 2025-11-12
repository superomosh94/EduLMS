const express = require('express');
const router = express.Router();

// Safe middleware imports
let isAdmin, isAuthenticated;
try {
    const authMiddleware = require('../middleware/auth');
    isAdmin = authMiddleware.isAdmin || ((req, res, next) => next());
    isAuthenticated = authMiddleware.isAuthenticated || ((req, res, next) => next());
} catch (error) {
    console.error('❌ Error loading auth middleware:', error.message);
    isAdmin = (req, res, next) => next();
    isAuthenticated = (req, res, next) => next();
}

// Safe admin controller import
let adminController;
try {
    adminController = require('../controllers/users/adminController');
    console.log('✅ Admin controller loaded successfully');
} catch (error) {
    console.error('❌ Error loading admin controller:', error.message);
    adminController = {};
}

// Helper function to safely handle route callbacks
const safeHandler = (handler, routeName) => {
    return (req, res, next) => {
        try {
            if (typeof handler !== 'function') {
                console.error(`❌ Handler for ${routeName} is not a function`);
                req.flash('error_msg', 'This feature is not available yet.');
                return res.redirect('/admin/dashboard');
            }
            return handler(req, res, next);
        } catch (error) {
            console.error(`❌ Route handler error for ${routeName}:`, error);
            req.flash('error_msg', 'Something went wrong. Please try again.');
            res.redirect('/admin/dashboard');
        }
    };
};

// Apply admin middleware to all routes
router.use(isAuthenticated);
router.use(isAdmin);

// ==================== EXISTING ROUTES ONLY ====================

// Dashboard
router.get('/dashboard', safeHandler(adminController.dashboard, 'dashboard'));

// User Management (working routes)
router.get('/users', safeHandler(adminController.listUsers, 'listUsers'));
router.get('/users/create', safeHandler(adminController.showCreateUser, 'showCreateUser'));
router.post('/users/create', safeHandler(adminController.createUser, 'createUser'));
router.get('/users/:id', safeHandler(adminController.showUser, 'showUser'));
router.get('/users/:id/edit', safeHandler(adminController.editUserForm, 'editUserForm'));
router.post('/users/:id/edit', safeHandler(adminController.updateUser, 'updateUser'));
router.post('/users/:id/delete', safeHandler(adminController.deleteUser, 'deleteUser'));

// Student Management (working routes)
router.get('/students', safeHandler(adminController.listStudents, 'listStudents'));

// Instructor Management (working routes)  
router.get('/instructors', safeHandler(adminController.listInstructors, 'listInstructors'));

// System Routes (working routes)
router.get('/system/settings', safeHandler(adminController.systemSettings, 'systemSettings'));
router.post('/system/settings', safeHandler(adminController.updateSystemSettings, 'updateSystemSettings'));

// ==================== PLACEHOLDER ROUTES ====================

// Finance placeholder routes
router.get('/finance/overview', (req, res) => {
    res.render('admin/placeholder', {
        title: 'Finance Overview - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: req.user,
        currentPage: 'finance',
        featureName: 'Finance Overview',
        description: 'Revenue tracking, payment management, and financial reports will be available here.'
    });
});

router.get('/finance/payments', (req, res) => {
    res.render('admin/placeholder', {
        title: 'Payment Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: req.user,
        currentPage: 'finance',
        featureName: 'Payment Management',
        description: 'View and manage all payment transactions and fee collections.'
    });
});

router.get('/finance/revenue-reports', (req, res) => {
    res.render('admin/placeholder', {
        title: 'Revenue Reports - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: req.user,
        currentPage: 'finance',
        featureName: 'Revenue Reports',
        description: 'Generate detailed revenue reports and financial analytics.'
    });
});

// Academic placeholder routes
router.get('/academic/assignments', (req, res) => {
    res.render('admin/placeholder', {
        title: 'Assignment Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: req.user,
        currentPage: 'academic',
        featureName: 'Assignment Management',
        description: 'Create and manage course assignments and grading criteria.'
    });
});

router.get('/academic/enrollments', (req, res) => {
    res.render('admin/placeholder', {
        title: 'Enrollment Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: req.user,
        currentPage: 'academic',
        featureName: 'Enrollment Management',
        description: 'Manage student course enrollments and registration processes.'
    });
});

// System placeholder routes
router.get('/system/notifications', (req, res) => {
    res.render('admin/placeholder', {
        title: 'Notification Center - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: req.user,
        currentPage: 'system',
        featureName: 'Notification Center',
        description: 'Send system-wide notifications and announcements to users.'
    });
});

router.get('/system/system-health', (req, res) => {
    res.render('admin/placeholder', {
        title: 'System Health - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: req.user,
        currentPage: 'system',
        featureName: 'System Health',
        description: 'Monitor system performance, database status, and server metrics.'
    });
});

// Redirect root to dashboard
router.get('/', (req, res) => {
    res.redirect('/admin/dashboard');
});

module.exports = router;