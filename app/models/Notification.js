// Simple Notification model without Sequelize for now
let notifications = []; // Temporary in-memory storage

class Notification {
    constructor(data) {
        this.id = data.id || Date.now();
        this.title = data.title;
        this.message = data.message;
        this.type = data.type || 'system';
        this.priority = data.priority || 'normal';
        this.audience = data.audience || 'all';
        this.status = data.status || 'unread';
        this.createdBy = data.createdBy || 1;
        this.createdAt = data.createdAt || new Date();
        this.sentAt = data.sentAt || null;
        this.scheduledDate = data.scheduledDate || null;
        this.recipients = data.recipients || [];
        this.customRecipients = data.customRecipients || [];
    }

    static async findAll(options = {}) {
        // Simulate database query
        let result = [...notifications];
        
        if (options.order) {
            const [field, direction] = options.order[0];
            result.sort((a, b) => {
                if (direction === 'DESC') {
                    return new Date(b[field]) - new Date(a[field]);
                }
                return new Date(a[field]) - new Date(b[field]);
            });
        }
        
        if (options.limit) {
            result = result.slice(0, options.limit);
        }
        
        return result;
    }

    static async create(data) {
        const notification = new Notification(data);
        notifications.push(notification);
        return notification;
    }

    static async bulkCreate(dataArray) {
        const created = [];
        for (const data of dataArray) {
            const notification = await this.create(data);
            created.push(notification);
        }
        return created;
    }

    static async findById(id) {
        return notifications.find(n => n.id == id) || null;
    }

    static async countDocuments() {
        return notifications.length;
    }

    async save() {
        // In real implementation, this would update the database
        const index = notifications.findIndex(n => n.id === this.id);
        if (index !== -1) {
            notifications[index] = this;
        }
        return this;
    }

    static async deleteMany(conditions) {
        if (conditions._id && conditions._id.$in) {
            notifications = notifications.filter(n => !conditions._id.$in.includes(n.id));
        }
    }

    static async updateMany(conditions, update) {
        const notificationsToUpdate = notifications.filter(n => 
            conditions._id.$in.includes(n.id)
        );
        
        notificationsToUpdate.forEach(n => {
            Object.assign(n, update.$set);
        });
    }
}

// Create some sample notifications for testing
notifications = [
    new Notification({
        id: 1,
        title: 'Welcome to EduLMS',
        message: 'Welcome to our Learning Management System. We are excited to have you on board!',
        type: 'system',
        priority: 'normal',
        audience: 'all',
        status: 'sent',
        createdBy: 1,
        sentAt: new Date(),
        createdAt: new Date(Date.now() - 86400000) // 1 day ago
    }),
    new Notification({
        id: 2,
        title: 'System Maintenance Scheduled',
        message: 'There will be scheduled maintenance on Saturday from 2:00 AM to 4:00 AM. The system may be unavailable during this time.',
        type: 'system',
        priority: 'high',
        audience: 'all',
        status: 'unread',
        createdBy: 1,
        createdAt: new Date()
    }),
    new Notification({
        id: 3,
        title: 'New Course Available',
        message: 'A new course "Advanced JavaScript Programming" has been added to the curriculum. Check it out!',
        type: 'academic',
        priority: 'normal',
        audience: 'students',
        status: 'sent',
        createdBy: 1,
        sentAt: new Date(Date.now() - 172800000), // 2 days ago
        createdAt: new Date(Date.now() - 172800000)
    })
];

module.exports = Notification;