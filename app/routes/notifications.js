const express = require('express');
const router = express.Router();

// Import the controller with proper error handling
let notificationController;
try {
    notificationController = require('../controllers/system/notificationController');
    console.log('✅ Notification controller imported successfully');
} catch (error) {
    console.error('❌ Failed to import notification controller:', error);
    // Create stub functions if import fails
    notificationController = {
        getNotifications: (req, res) => res.send('Notifications - Controller not loaded'),
        getCreateNotification: (req, res) => res.send('Create Notification - Controller not loaded'),
        createNotification: (req, res) => res.redirect('/admin/system/notifications'),
        getNotificationDetails: (req, res) => res.send('Notification Details - Controller not loaded'),
        deleteNotification: (req, res) => res.json({ success: false }),
        bulkAction: (req, res) => res.json({ success: false })
    };
}

// Define routes
router.get('/', notificationController.getNotifications);
router.get('/create', notificationController.getCreateNotification);
router.post('/create', notificationController.createNotification);
router.get('/:id', notificationController.getNotificationDetails);
router.delete('/:id', notificationController.deleteNotification);
router.post('/bulk-action', notificationController.bulkAction);

console.log('✅ Notification routes configured');

module.exports = router;