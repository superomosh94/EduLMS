const express = require('express');
const router = express.Router();

// Import notification routes with error handling
let notificationRoutes;
try {
    notificationRoutes = require('./notifications');
    console.log('✅ Notification routes imported successfully');
} catch (error) {
    console.error('❌ Failed to import notification routes:', error);
    // Create a stub router if import fails
    notificationRoutes = express.Router();
    notificationRoutes.get('/', (req, res) => res.send('Notifications route not available'));
}

// Mount the routes
router.use('/notifications', notificationRoutes);

// Other system routes
router.get('/settings', (req, res) => {
    res.render('admin/system/settings', { title: 'System Settings' });
});

router.get('/audit-logs', (req, res) => {
    res.render('admin/system/audit-logs', { title: 'Audit Logs' });
});

router.get('/backup', (req, res) => {
    res.render('admin/system/backup', { title: 'Backup & Restore' });
});

router.get('/system-health', (req, res) => {
    res.render('admin/system/system-health', { title: 'System Health' });
});

console.log('✅ System routes configured');



module.exports = router;