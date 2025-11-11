const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const notificationController = require('../controllers/system/notificationController');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Notification management
router.get('/', notificationController.getNotifications);
router.get('/unread', notificationController.getUnreadNotifications);
router.get('/:notificationId', notificationController.getNotification);
router.post('/:notificationId/mark-read', notificationController.markAsRead);
router.post('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:notificationId', notificationController.deleteNotification);

// Notification preferences
router.get('/preferences', notificationController.getPreferences);
router.post('/preferences', notificationController.updatePreferences);

// Notification statistics
router.get('/stats', notificationController.getNotificationStats);

// API endpoints for real-time notifications
router.get('/api/recent', notificationController.getRecentNotifications);
router.get('/api/unread-count', notificationController.getUnreadCount);
router.post('/api/register-device', notificationController.registerDevice);

// Admin notification management
router.get('/admin/templates', notificationController.getNotificationTemplates);
router.post('/admin/templates', notificationController.createNotificationTemplate);
router.put('/admin/templates/:templateId', notificationController.updateNotificationTemplate);
router.delete('/admin/templates/:templateId', notificationController.deleteNotificationTemplate);

// Bulk notification sending
router.get('/admin/send-notification', notificationController.showSendNotification);
router.post('/admin/send-notification', notificationController.sendBulkNotification);

// Notification analytics
router.get('/admin/analytics', notificationController.getNotificationAnalytics);
router.get('/admin/delivery-stats', notificationController.getDeliveryStatistics);

module.exports = router;