const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const systemController = require('../controllers/system/systemController');

// Public system routes
router.get('/health', systemController.healthCheck);
router.get('/version', systemController.getVersion);

// Apply authentication middleware to all other routes
router.use(isAuthenticated);

// System settings (admin only)
router.get('/settings', isAdmin, systemController.getSystemSettings);
router.put('/settings', isAdmin, systemController.updateSystemSettings);
router.get('/settings/backup', isAdmin, systemController.getBackupSettings);
router.post('/settings/backup', isAdmin, systemController.updateBackupSettings);

// Backup management (admin only)
router.get('/backup', isAdmin, systemController.getBackups);
router.post('/backup/create', isAdmin, systemController.createBackup);
router.get('/backup/:backupId/download', isAdmin, systemController.downloadBackup);
router.delete('/backup/:backupId', isAdmin, systemController.deleteBackup);
router.post('/backup/restore/:backupId', isAdmin, systemController.restoreBackup);

// System logs (admin only)
router.get('/logs/audit', isAdmin, systemController.getAuditLogs);
router.get('/logs/error', isAdmin, systemController.getErrorLogs);
router.get('/logs/access', isAdmin, systemController.getAccessLogs);
router.delete('/logs/clear', isAdmin, systemController.clearLogs);

// System maintenance (admin only)
router.get('/maintenance', isAdmin, systemController.getMaintenanceMode);
router.post('/maintenance/enable', isAdmin, systemController.enableMaintenance);
router.post('/maintenance/disable', isAdmin, systemController.disableMaintenance);

// System statistics
router.get('/stats', isAdmin, systemController.getSystemStats);
router.get('/stats/usage', isAdmin, systemController.getUsageStats);
router.get('/stats/performance', isAdmin, systemController.getPerformanceStats);

// User management utilities
router.get('/users/activity', isAdmin, systemController.getUserActivity);
router.get('/users/sessions', isAdmin, systemController.getActiveSessions);
router.post('/users/sessions/:sessionId/terminate', isAdmin, systemController.terminateSession);

// Database management (admin only)
router.get('/database/tables', isAdmin, systemController.getDatabaseTables);
router.get('/database/query', isAdmin, systemController.executeQuery);
router.post('/database/optimize', isAdmin, systemController.optimizeDatabase);

// Cache management (admin only)
router.get('/cache/status', isAdmin, systemController.getCacheStatus);
router.post('/cache/clear', isAdmin, systemController.clearCache);
router.post('/cache/clear/:key', isAdmin, systemController.clearCacheKey);

// Email system management
router.get('/email/test', isAdmin, systemController.testEmailConfiguration);
router.get('/email/queue', isAdmin, systemController.getEmailQueue);
router.post('/email/retry-failed', isAdmin, systemController.retryFailedEmails);

// File system management
router.get('/storage/stats', isAdmin, systemController.getStorageStats);
router.post('/storage/cleanup', isAdmin, systemController.cleanupStorage);
router.get('/storage/backup', isAdmin, systemController.backupStorage);

// API endpoints for system monitoring
router.get('/api/status', systemController.getSystemStatus);
router.get('/api/resources', systemController.getResourceUsage);
router.get('/api/uptime', systemController.getUptime);

// System updates
router.get('/updates/check', isAdmin, systemController.checkForUpdates);
router.post('/updates/apply', isAdmin, systemController.applyUpdates);

module.exports = router;