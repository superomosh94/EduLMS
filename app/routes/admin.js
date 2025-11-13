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

// Safe admin middleware import
let setAdminLayoutData;
try {
    const adminMiddleware = require('../middleware/adminMiddleware');
    setAdminLayoutData = adminMiddleware.setAdminLayoutData || ((req, res, next) => next());
} catch (error) {
    console.error('❌ Error loading admin middleware:', error.message);
    setAdminLayoutData = (req, res, next) => {
        // Basic fallback middleware
        res.locals.pageTitle = res.locals.pageTitle || 'Admin Dashboard';
        res.locals.currentUser = req.user;
        res.locals.messages = {
            success: req.flash('success') || [],
            error: req.flash('error') || [],
            warning: req.flash('warning') || [],
            info: req.flash('info') || []
        };
        next();
    };
}

// Helper function to safely handle route callbacks
const safeHandler = (handler, routeName) => {
    return (req, res, next) => {
        try {
            if (typeof handler !== 'function') {
                console.error(`❌ Handler for ${routeName} is not a function`);
                req.flash('error', 'This feature is not available yet.');
                return res.redirect('/admin/dashboard');
            }
            return handler(req, res, next);
        } catch (error) {
            console.error(`❌ Route handler error for ${routeName}:`, error);
            req.flash('error', 'Something went wrong. Please try again.');
            res.redirect('/admin/dashboard');
        }
    };
};

// Apply middleware to all admin routes
router.use(isAuthenticated);
router.use(isAdmin);
router.use(setAdminLayoutData);

// ==================== DASHBOARD ROUTES ====================

// Dashboard
router.get('/dashboard', (req, res) => {
    res.locals.pageTitle = 'Admin Dashboard';
    safeHandler(adminController.dashboard, 'dashboard')(req, res);
});

// ==================== USER MANAGEMENT ROUTES ====================

// User Management
router.get('/users', (req, res) => {
    res.locals.pageTitle = 'Manage Users';
    safeHandler(adminController.listUsers, 'listUsers')(req, res);
});

// Student Management - FIXED PATH
router.get('/users/students', (req, res) => {
    res.locals.pageTitle = 'Manage Students';
    safeHandler(adminController.listStudents, 'listStudents')(req, res);
});

// Instructor Management - FIXED PATH  
router.get('/users/instructors', (req, res) => {
    res.locals.pageTitle = 'Manage Instructors';
    safeHandler(adminController.listInstructors, 'listInstructors')(req, res);
});

// Finance Officers Management
router.get('/users/finance-officers', (req, res) => {
    res.locals.pageTitle = 'Finance Officers';
    safeHandler(adminController.listFinanceOfficers, 'listFinanceOfficers')(req, res);
});

router.get('/users/create', (req, res) => {
    res.locals.pageTitle = 'Create User';
    safeHandler(adminController.showCreateUser, 'showCreateUser')(req, res);
});

router.post('/users/create', (req, res) => {
    safeHandler(adminController.createUser, 'createUser')(req, res);
});

router.get('/users/:id', (req, res) => {
    res.locals.pageTitle = 'User Details';
    safeHandler(adminController.showUser, 'showUser')(req, res);
});

router.get('/users/:id/edit', (req, res) => {
    res.locals.pageTitle = 'Edit User';
    safeHandler(adminController.editUserForm, 'editUserForm')(req, res);
});

router.post('/users/:id/edit', (req, res) => {
    safeHandler(adminController.updateUser, 'updateUser')(req, res);
});

router.post('/users/:id/delete', (req, res) => {
    safeHandler(adminController.deleteUser, 'deleteUser')(req, res);
});

// ==================== COURSE MANAGEMENT ROUTES ====================

// Course Management
router.get('/courses', (req, res) => {
    res.locals.pageTitle = 'Manage Courses';
    safeHandler(adminController.listCourses, 'listCourses')(req, res);
});

// View single course details
router.get('/courses/:id', (req, res) => {
    res.locals.pageTitle = 'Course Details';
    safeHandler(adminController.viewCourse, 'viewCourse')(req, res);
});

// Show create course form
router.get('/courses/create', (req, res) => {
    res.locals.pageTitle = 'Create Course';
    safeHandler(adminController.showCreateCourse, 'showCreateCourse')(req, res);
});

// Create new course
router.post('/courses/create', (req, res) => {
    safeHandler(adminController.createCourse, 'createCourse')(req, res);
});

// Show edit course form
router.get('/courses/:id/edit', (req, res) => {
    res.locals.pageTitle = 'Edit Course';
    safeHandler(adminController.editCourseForm, 'editCourseForm')(req, res);
});

// Update course
router.post('/courses/:id/edit', (req, res) => {
    safeHandler(adminController.updateCourse, 'updateCourse')(req, res);
});

// Delete course
router.post('/courses/:id/delete', (req, res) => {
    safeHandler(adminController.deleteCourse, 'deleteCourse')(req, res);
});

// Course management (enrollments, etc.)
router.get('/courses/:id/manage', (req, res) => {
    res.locals.pageTitle = 'Manage Course';
    safeHandler(adminController.manageCourse, 'manageCourse')(req, res);
});

// ==================== ACADEMIC MANAGEMENT ROUTES ====================

// Enrollment management
router.get('/enrollments', (req, res) => {
    res.locals.pageTitle = 'Enrollment Management';
    safeHandler(adminController.listEnrollments, 'listEnrollments')(req, res);
});

// Assignment management
router.get('/assignments', (req, res) => {
    res.locals.pageTitle = 'Assignment Management';
    safeHandler(adminController.listAssignments, 'listAssignments')(req, res);
});

// Grade management
router.get('/grades', (req, res) => {
    res.locals.pageTitle = 'Grade Management';
    safeHandler(adminController.listGrades, 'listGrades')(req, res);
});

// Submission management
router.get('/submissions', (req, res) => {
    res.locals.pageTitle = 'Submission Management';
    safeHandler(adminController.listSubmissions, 'listSubmissions')(req, res);
});

// ==================== FINANCE MANAGEMENT ROUTES ====================

// Finance Overview
router.get('/finance/overview', (req, res) => {
    res.locals.pageTitle = 'Finance Overview';
    safeHandler(adminController.financeOverview, 'financeOverview')(req, res);
});

// Payment Management
router.get('/finance/payments', (req, res) => {
    res.locals.pageTitle = 'Payment Management';
    safeHandler(adminController.listPayments, 'listPayments')(req, res);
});

// Fee Structure Management
router.get('/finance/fee-structure', (req, res) => {
    res.locals.pageTitle = 'Fee Structure';
    safeHandler(adminController.listFeeStructures, 'listFeeStructures')(req, res);
});

// Revenue Reports
router.get('/finance/revenue-reports', (req, res) => {
    res.locals.pageTitle = 'Revenue Reports';
    safeHandler(adminController.revenueReports, 'revenueReports')(req, res);
});

// ==================== SYSTEM MANAGEMENT ROUTES ====================

// System Settings
router.get('/system/settings', (req, res) => {
    res.locals.pageTitle = 'System Settings';
    safeHandler(adminController.systemSettings, 'systemSettings')(req, res);
});

router.post('/system/settings', (req, res) => {
    safeHandler(adminController.updateSystemSettings, 'updateSystemSettings')(req, res);
});

// Notification Center
router.get('/system/notifications', (req, res) => {
    res.locals.pageTitle = 'Notification Center';
    safeHandler(adminController.listNotifications, 'listNotifications')(req, res);
});

// System Health
router.get('/system/system-health', (req, res) => {
    res.locals.pageTitle = 'System Health';
    safeHandler(adminController.systemHealth, 'systemHealth')(req, res);
});

// Audit Logs
router.get('/system/audit-logs', (req, res) => {
    res.locals.pageTitle = 'Audit Logs';
    safeHandler(adminController.listAuditLogs, 'listAuditLogs')(req, res);
});

// Backup & Restore
router.get('/system/backup', (req, res) => {
    res.locals.pageTitle = 'Backup & Restore';
    safeHandler(adminController.backupManagement, 'backupManagement')(req, res);
});

// ==================== REPORTS ROUTES ====================

// Generate Reports
router.get('/reports/generate', (req, res) => {
    res.locals.pageTitle = 'Generate Reports';
    safeHandler(adminController.generateReports, 'generateReports')(req, res);
});

// Student Reports
router.get('/reports/student-reports', (req, res) => {
    res.locals.pageTitle = 'Student Reports';
    safeHandler(adminController.studentReports, 'studentReports')(req, res);
});

// Financial Reports
router.get('/reports/financial-reports', (req, res) => {
    res.locals.pageTitle = 'Financial Reports';
    safeHandler(adminController.financialReports, 'financialReports')(req, res);
});

// Academic Reports
router.get('/reports/academic-reports', (req, res) => {
    res.locals.pageTitle = 'Academic Reports';
    safeHandler(adminController.academicReports, 'academicReports')(req, res);
});

// ==================== PLACEHOLDER ROUTES (For features not yet implemented) ====================

// Academic placeholder routes (fallbacks for missing controller methods)
router.get('/academic/assignments', (req, res) => {
    res.locals.pageTitle = 'Assignment Management';
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
    res.locals.pageTitle = 'Enrollment Management';
    res.render('admin/placeholder', {
        title: 'Enrollment Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: req.user,
        currentPage: 'academic',
        featureName: 'Enrollment Management',
        description: 'Manage student course enrollments and registration processes.'
    });
});

router.get('/academic/submissions', (req, res) => {
    res.locals.pageTitle = 'Submission Management';
    res.render('admin/placeholder', {
        title: 'Submission Management - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: req.user,
        currentPage: 'academic',
        featureName: 'Submission Management',
        description: 'View and manage student assignment submissions and grading status.'
    });
});

router.get('/academic/grades-overview', (req, res) => {
    res.locals.pageTitle = 'Grades Overview';
    res.render('admin/placeholder', {
        title: 'Grades Overview - EduLMS',
        layout: 'layouts/admin-layout',
        currentUser: req.user,
        currentPage: 'academic',
        featureName: 'Grades Overview',
        description: 'Monitor and manage student grades across all courses and assignments.'
    });
});

// Redirect root to dashboard
router.get('/', (req, res) => {
    res.redirect('/admin/dashboard');
});

module.exports = router; 