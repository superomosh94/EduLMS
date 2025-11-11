const db = require('../../config/database');
const { Generators, Helpers, Formatters } = require('../utils');

class NotificationService {
  constructor() {
    this.types = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
      SUCCESS: 'success',
      SYSTEM: 'system',
      PAYMENT: 'payment',
      ACADEMIC: 'academic',
      FINANCIAL: 'financial'
    };

    this.channels = {
      IN_APP: 'in_app',
      EMAIL: 'email',
      SMS: 'sms',
      PUSH: 'push'
    };
  }

  /**
   * Create and send notification
   */
  async createNotification(notificationData) {
    try {
      const {
        title,
        message,
        type = this.types.INFO,
        priority = 'medium',
        channels = [this.channels.IN_APP],
        recipientIds = [],
        recipientRoles = [],
        senderId = null,
        relatedEntity = null,
        relatedEntityId = null,
        actionUrl = null,
        expiresAt = null
      } = notificationData;

      // Validate inputs
      if (!title || !message) {
        throw new Error('Title and message are required');
      }

      if (recipientIds.length === 0 && recipientRoles.length === 0) {
        throw new Error('Either recipientIds or recipientRoles must be provided');
      }

      // Get recipient user IDs
      let userIds = [...recipientIds];

      if (recipientRoles.length > 0) {
        const roleUsers = await this.getUsersByRoles(recipientRoles);
        userIds = [...userIds, ...roleUsers.map(user => user.id)];
      }

      // Remove duplicates
      userIds = [...new Set(userIds)];

      if (userIds.length === 0) {
        throw new Error('No recipients found for the notification');
      }

      const notificationId = Generators.generateNotificationId();
      const results = [];

      // Create notifications for each user
      for (const userId of userIds) {
        try {
          const notification = await this.saveNotification({
            id: notificationId,
            user_id: userId,
            title,
            message,
            type,
            priority,
            channels: JSON.stringify(channels),
            sender_id: senderId,
            related_entity: relatedEntity,
            related_entity_id: relatedEntityId,
            action_url: actionUrl,
            expires_at: expiresAt
          });

          results.push({
            userId,
            success: true,
            notificationId: notification.id
          });

          // Send through specified channels
          await this.deliverNotification(notification, userId, channels);

        } catch (error) {
          console.error(`❌ Failed to create notification for user ${userId}:`, error);
          results.push({
            userId,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        notificationId,
        results,
        totalSent: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length
      };

    } catch (error) {
      console.error('❌ Notification creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save notification to database
   */
  async saveNotification(notificationData) {
    const result = await db.query(
      `INSERT INTO notifications SET ?`,
      [notificationData]
    );

    return {
      id: notificationData.id,
      ...notificationData
    };
  }

  /**
   * Deliver notification through specified channels
   */
  async deliverNotification(notification, userId, channels) {
    const deliveryResults = [];

    for (const channel of channels) {
      try {
        let result;
        
        switch (channel) {
          case this.channels.IN_APP:
            result = await this.deliverInAppNotification(notification, userId);
            break;
          case this.channels.EMAIL:
            result = await this.deliverEmailNotification(notification, userId);
            break;
          case this.channels.SMS:
            result = await this.deliverSmsNotification(notification, userId);
            break;
          case this.channels.PUSH:
            result = await this.deliverPushNotification(notification, userId);
            break;
          default:
            result = { success: false, error: `Unknown channel: ${channel}` };
        }

        deliveryResults.push({
          channel,
          success: result.success,
          error: result.error
        });

      } catch (error) {
        console.error(`❌ Delivery failed for channel ${channel}:`, error);
        deliveryResults.push({
          channel,
          success: false,
          error: error.message
        });
      }
    }

    return deliveryResults;
  }

  /**
   * Deliver in-app notification
   */
  async deliverInAppNotification(notification, userId) {
    // In-app notifications are automatically available when saved to database
    // We can update user's unread count or perform other in-app specific logic here
    
    await this.updateUnreadCount(userId);
    
    return { success: true };
  }

  /**
   * Deliver email notification
   */
  async deliverEmailNotification(notification, userId) {
    const emailService = require('./emailService');
    const user = await this.getUserById(userId);

    if (!user || !user.email) {
      return { success: false, error: 'User not found or no email address' };
    }

    const emailData = {
      siteName: process.env.SITE_NAME || 'EduLMS',
      userName: Formatters.formatName(user.first_name, user.last_name),
      notificationTitle: notification.title,
      notificationMessage: notification.message,
      notificationUrl: notification.action_url,
      supportEmail: process.env.SUPPORT_EMAIL,
      currentYear: new Date().getFullYear()
    };

    const result = await emailService.sendEmail(
      user.email,
      notification.title,
      'system-notification',
      emailData
    );

    return result;
  }

  /**
   * Deliver SMS notification
   */
  async deliverSmsNotification(notification, userId) {
    const smsService = require('./smsService');
    const user = await this.getUserById(userId);

    if (!user || !user.phone) {
      return { success: false, error: 'User not found or no phone number' };
    }

    // Truncate message for SMS
    const smsMessage = notification.message.length > 160 
      ? notification.message.substring(0, 157) + '...' 
      : notification.message;

    const result = await smsService.sendSMS(
      user.phone,
      smsMessage
    );

    return result;
  }

  /**
   * Deliver push notification
   */
  async deliverPushNotification(notification, userId) {
    // This would integrate with a push notification service like Firebase
    // For now, we'll log it and return success
    console.log(`📱 Push notification would be sent to user ${userId}: ${notification.title}`);
    
    return { success: true };
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      type = null,
      markAsRead = false
    } = options;

    const offset = (page - 1) * limit;

    let query = `
      SELECT n.*, 
             u.first_name as sender_first_name,
             u.last_name as sender_last_name
      FROM notifications n
      LEFT JOIN users u ON n.sender_id = u.id
      WHERE n.user_id = ?
    `;

    let countQuery = `SELECT COUNT(*) as total FROM notifications WHERE user_id = ?`;
    const params = [userId];
    const countParams = [userId];

    if (unreadOnly) {
      query += ' AND n.is_read = 0';
      countQuery += ' AND is_read = 0';
    }

    if (type) {
      query += ' AND n.type = ?';
      countQuery += ' AND type = ?';
      params.push(type);
      countParams.push(type);
    }

    query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [notifications, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams)
    ]);

    // Mark as read if requested
    if (markAsRead && notifications.length > 0) {
      const notificationIds = notifications.map(n => n.id);
      await this.markAsRead(notificationIds, userId);
    }

    return {
      notifications,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(notificationIds, userId) {
    if (!Array.isArray(notificationIds)) {
      notificationIds = [notificationIds];
    }

    if (notificationIds.length === 0) return;

    const placeholders = notificationIds.map(() => '?').join(',');
    
    await db.query(
      `UPDATE notifications 
       SET is_read = 1, read_at = NOW() 
       WHERE id IN (${placeholders}) AND user_id = ?`,
      [...notificationIds, userId]
    );

    // Update unread count
    await this.updateUnreadCount(userId);
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId) {
    await db.query(
      `UPDATE notifications 
       SET is_read = 1, read_at = NOW() 
       WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    await this.updateUnreadCount(userId);
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    const result = await db.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (result.affectedRows > 0) {
      await this.updateUnreadCount(userId);
      return { success: true };
    } else {
      return { success: false, error: 'Notification not found or access denied' };
    }
  }

  /**
   * Get notification statistics for user
   */
  async getUserNotificationStats(userId) {
    const stats = await db.query(`
      SELECT 
        type,
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
      FROM notifications 
      WHERE user_id = ?
      GROUP BY type
    `, [userId]);

    const totalStats = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_total
      FROM notifications 
      WHERE user_id = ?
    `, [userId]);

    return {
      byType: stats,
      total: totalStats[0].total,
      unreadTotal: totalStats[0].unread_total
    };
  }

  /**
   * Update user's unread notification count
   */
  async updateUnreadCount(userId) {
    const countResult = await db.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    const unreadCount = countResult[0].unread_count;

    // This could be cached in Redis or stored in user preferences
    // For now, we'll just return it
    return unreadCount;
  }

  /**
   * Get users by roles
   */
  async getUsersByRoles(roles) {
    const placeholders = roles.map(() => '?').join(',');
    
    const users = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name IN (${placeholders}) AND u.is_active = 1`,
      roles
    );

    return users;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const users = await db.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [userId]
    );

    return users[0] || null;
  }

  /**
   * Create system-wide notification
   */
  async createSystemNotification(title, message, options = {}) {
    const allUsers = await this.getUsersByRoles(['admin', 'instructor', 'student', 'finance_officer']);
    const recipientIds = allUsers.map(user => user.id);

    return this.createNotification({
      title,
      message,
      type: this.types.SYSTEM,
      recipientIds,
      ...options
    });
  }

  /**
   * Create payment notification
   */
  async createPaymentNotification(payment, student, type = 'payment') {
    const title = type === 'success' ? 'Payment Successful' : 'Payment Failed';
    const message = type === 'success' 
      ? `Your payment of ${Helpers.formatCurrency(payment.amount)} has been processed successfully. Receipt: ${payment.mpesa_receipt}`
      : `Your payment of ${Helpers.formatCurrency(payment.amount)} failed. Reason: ${payment.failure_reason}`;

    return this.createNotification({
      title,
      message,
      type: this.types.PAYMENT,
      recipientIds: [student.user_id],
      relatedEntity: 'payment',
      relatedEntityId: payment.id,
      actionUrl: `/student/payments/${payment.id}`
    });
  }

  /**
   * Create assignment notification
   */
  async createAssignmentNotification(assignment, students, course, type = 'created') {
    const title = type === 'created' 
      ? 'New Assignment' 
      : 'Assignment Updated';
    
    const message = type === 'created'
      ? `New assignment "${assignment.title}" has been posted for ${course.title}`
      : `Assignment "${assignment.title}" in ${course.title} has been updated`;

    const recipientIds = students.map(student => student.user_id);

    return this.createNotification({
      title,
      message,
      type: this.types.ACADEMIC,
      recipientIds,
      relatedEntity: 'assignment',
      relatedEntityId: assignment.id,
      actionUrl: `/student/assignments/${assignment.id}`,
      channels: [this.channels.IN_APP, this.channels.EMAIL]
    });
  }

  /**
   * Create grade notification
   */
  async createGradeNotification(grade, student, assignment, course) {
    const title = 'Grade Posted';
    const message = `Your assignment "${assignment.title}" has been graded. Score: ${grade.score}/${assignment.total_points}`;

    return this.createNotification({
      title,
      message,
      type: this.types.ACADEMIC,
      recipientIds: [student.user_id],
      relatedEntity: 'grade',
      relatedEntityId: grade.id,
      actionUrl: `/student/grades`,
      channels: [this.channels.IN_APP, this.channels.EMAIL]
    });
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications() {
    const result = await db.query(
      'DELETE FROM notifications WHERE expires_at < NOW()'
    );

    console.log(`🧹 Cleaned up ${result.affectedRows} expired notifications`);
    return result.affectedRows;
  }

  /**
   * Get notification delivery statistics
   */
  async getDeliveryStats(startDate, endDate) {
    const stats = await db.query(`
      SELECT 
        DATE(created_at) as date,
        type,
        COUNT(*) as total_sent,
        SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as total_read
      FROM notifications 
      WHERE created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at), type
      ORDER BY date DESC, type
    `, [startDate, endDate]);

    return stats;
  }
}

module.exports = new NotificationService();