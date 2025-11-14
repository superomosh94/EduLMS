// Simple notification controller for testing
console.log('🔔 Notification controller loaded');

const getNotifications = async (req, res) => {
    try {
        console.log('🔔 getNotifications function called');
        
        // Sample notifications data
        const notifications = [
            {
                id: 1,
                title: 'Welcome to EduLMS',
                message: 'Welcome to our Learning Management System. We are excited to have you on board!',
                type: 'system',
                priority: 'normal',
                audience: 'all',
                status: 'sent',
                createdAt: new Date('2024-01-15'),
                createdBy: 1
            },
            {
                id: 2,
                title: 'System Maintenance',
                message: 'There will be scheduled maintenance on Saturday from 2:00 AM to 4:00 AM.',
                type: 'system',
                priority: 'high',
                audience: 'all',
                status: 'unread',
                createdAt: new Date('2024-01-16'),
                createdBy: 1
            },
            {
                id: 3,
                title: 'New Course Available',
                message: 'A new course "Advanced JavaScript" has been added to the curriculum.',
                type: 'academic',
                priority: 'normal',
                audience: 'students',
                status: 'sent',
                createdAt: new Date('2024-01-14'),
                createdBy: 1
            }
        ];

        console.log(`🔔 Rendering with ${notifications.length} notifications`);

        res.render('admin/notifications/list', {
            title: 'Notifications',
            notifications: notifications,
            pagination: {
                current: 1,
                pages: 1,
                total: notifications.length,
                hasNext: false,
                hasPrev: false
            },
            stats: {
                totalStudents: 150,
                totalInstructors: 25
            }
        });

    } catch (error) {
        console.error('❌ Error in getNotifications:', error);
        res.status(500).send('Error: ' + error.message);
    }
};

const getCreateNotification = async (req, res) => {
    try {
        console.log('🔔 getCreateNotification function called');
        res.render('admin/notifications/create', {
            title: 'Create Notification',
            students: [],
            instructors: [],
            stats: {
                totalStudents: 150,
                totalInstructors: 25
            }
        });
    } catch (error) {
        console.error('Error in getCreateNotification:', error);
        res.redirect('/admin/system/notifications');
    }
};

const createNotification = async (req, res) => {
    try {
        console.log('🔔 createNotification function called');
        const { title, message, type, audience } = req.body;
        console.log('New notification:', { title, message, type, audience });
        
        // For now, just redirect back
        res.redirect('/admin/system/notifications');
    } catch (error) {
        console.error('Error in createNotification:', error);
        res.redirect('/admin/system/notifications/create');
    }
};

const getNotificationDetails = async (req, res) => {
    try {
        console.log('🔔 getNotificationDetails function called for ID:', req.params.id);
        
        const notification = {
            id: req.params.id,
            title: 'Sample Notification',
            message: 'This is a sample notification details page.',
            type: 'system',
            priority: 'normal',
            audience: 'all',
            status: 'sent',
            createdAt: new Date(),
            createdBy: 1
        };

        res.render('admin/notifications/view', {
            title: 'Notification Details',
            notification: notification,
            recipients: [],
            relatedNotifications: []
        });
    } catch (error) {
        console.error('Error in getNotificationDetails:', error);
        res.redirect('/admin/system/notifications');
    }
};

const deleteNotification = async (req, res) => {
    try {
        console.log('🔔 deleteNotification function called for ID:', req.params.id);
        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        console.error('Error in deleteNotification:', error);
        res.status(500).json({ success: false, message: 'Error deleting notification' });
    }
};

const bulkAction = async (req, res) => {
    try {
        console.log('🔔 bulkAction function called:', req.body);
        res.json({ success: true, message: 'Bulk action completed' });
    } catch (error) {
        console.error('Error in bulkAction:', error);
        res.status(500).json({ success: false, message: 'Error in bulk action' });
    }
};

// Export all functions
module.exports = {
    getNotifications,
    getCreateNotification,
    createNotification,
    getNotificationDetails,
    deleteNotification,
    bulkAction
};