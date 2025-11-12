const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/system/notificationController');
const { isAuthenticated, hasAnyRole } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// User notification management
router.get('/', notificationController.getUserNotifications);
router.get('/unread', notificationController.getUnreadNotifications);
router.get('/:id', notificationController.getNotification);
router.post('/:id/mark-read', notificationController.markAsRead);
router.post('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);

// Notification statistics
router.get('/stats', notificationController.getNotificationStats);

// API endpoints
router.get('/api/recent', notificationController.getRecentNotifications);
router.get('/api/unread-count', notificationController.getUnreadCount);

// Admin notification management
router.post('/create', 
  hasAnyRole(['admin']), 
  notificationController.createNotification
);

router.put('/:id', 
  hasAnyRole(['admin']), 
  notificationController.updateNotification
);

module.exports = router;