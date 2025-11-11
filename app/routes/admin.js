const express = require('express');
const router = express.Router();
const { isAdmin, isAuthenticated, logActivity } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const adminController = require('../controllers/users/adminController');
const { validateUserQuery, validateUserId, validateStatusUpdate, validateRoleUpdate } = require('../validators/userValidators');

// Apply admin middleware to all routes
router.use(isAuthenticated);
router.use(isAdmin);

// Admin dashboard
router.get('/dashboard', adminController.dashboard);

// User Management Routes
router.get('/users', validateUserQuery, adminController.listUsers);
router.get('/users/create', adminController.showCreateUser);
router.post('/users/create', logActivity('create', 'users'), adminController.createUser);
router.get('/users/:id', validateUserId, adminController.showUser);
router.get('/users/:id/edit', validateUserId, adminController.showEditUser);
router.post('/users/:id/edit', validateUserId, logActivity('update', 'users'), adminController.updateUser);
router.post('/users/:id/status', validateUserId, validateStatusUpdate, logActivity('update', 'users'), adminController.updateUserStatus);
router.post('/users/:id/role', validateUserId, validateRoleUpdate, logActivity('update', 'users'), adminController.updateUserRole);
router.post('/users/:id/delete', validateUserId, logActivity('delete', 'users'), adminController.deleteUser);

// Student Management
router.get('/students', adminController.listStudents);
router.get('/students/:id', adminController.showStudent);
router.post('/students/:id/enroll', logActivity('create', 'enrollments'), adminController.enrollStudent);
router.post('/students/:id/withdraw', logActivity('update', 'enrollments'), adminController.withdrawStudent);

// Instructor Management
router.get('/instructors', adminController.listInstructors);
router.get('/instructors/:id', adminController.showInstructor);
router.post('/instructors/:id/assign-course', logActivity('create', 'course_assignments'), adminController.assignCourse);

// Course Management Routes
router.get('/courses', adminController.listCourses);
router.get('/courses/create', adminController.showCreateCourse);
router.post('/courses/create', logActivity('create', 'courses'), adminController.createCourse);
router.get('/courses/:id', adminController.showCourse);
router.get('/courses/:id/edit', adminController.showEditCourse);
router.post('/courses/:id/edit', logActivity('update', 'courses'), adminController.updateCourse);
router.post('/courses/:id/status', logActivity('update', 'courses'), adminController.updateCourseStatus);
router.post('/courses/:id/delete', logActivity('delete', 'courses'), adminController.deleteCourse);

// Category Management
router.get('/categories', adminController.listCategories);
router.post('/categories/create', logActivity('create', 'categories'), adminController.createCategory);
router.post('/categories/:id/edit', logActivity('update', 'categories'), adminController.updateCategory);
router.post('/categories/:id/delete', logActivity('delete', 'categories'), adminController.deleteCategory);

// Finance Overview
router.get('/finance/overview', adminController.financeOverview);
router.get('/finance/payments', adminController.listPayments);
router.get('/finance/revenue-reports', adminController.revenueReports);

// Academic Management
router.get('/academic/assignments', adminController.listAssignments);
router.get('/academic/submissions', adminController.listSubmissions);
router.get('/academic/grades-overview', adminController.gradesOverview);
router.get('/academic/enrollments', adminController.listEnrollments);

// System Management Routes
router.get('/system/settings', adminController.systemSettings);
router.post('/system/settings', logActivity('update', 'system_settings'), adminController.updateSystemSettings);
router.get('/system/notifications', adminController.systemNotifications);
router.post('/system/notifications/send', logActivity('create', 'notifications'), adminController.sendNotification);
router.get('/system/audit-logs', adminController.auditLogs);
router.get('/system/backup', adminController.backupManagement);
router.post('/system/backup/create', logActivity('create', 'backups'), adminController.createBackup);
router.get('/system/health', adminController.systemHealth);

// Report Generation Routes
router.get('/reports/generate', adminController.showReportGenerator);
router.post('/reports/generate', logActivity('create', 'reports'), adminController.generateReport);
router.get('/reports/student-reports', adminController.studentReports);
router.get('/reports/financial-reports', adminController.financialReports);
router.get('/reports/academic-reports', adminController.academicReports);
router.get('/reports/attendance-reports', adminController.attendanceReports);
router.get('/reports/custom-reports', adminController.customReports);

// Bulk Operations
router.get('/bulk/import', adminController.showBulkImport);
router.post('/bulk/import-users', logActivity('create', 'users'), adminController.bulkImportUsers);
router.post('/bulk/import-courses', logActivity('create', 'courses'), adminController.bulkImportCourses);
router.post('/bulk/enroll-students', logActivity('create', 'enrollments'), adminController.bulkEnrollStudents);

// API endpoints for admin
router.get('/api/stats', adminController.getStats);
router.get('/api/users/count', adminController.getUsersCount);
router.get('/api/courses/count', adminController.getCoursesCount);
router.get('/api/payments/stats', adminController.getPaymentsStats);

module.exports = router;