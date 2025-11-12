const Notification = require('../../models/Notification');
const User = require('../../models/User');
const { notificationService } = require('../../services/notificationService');
const { emailService } = require('../../services/emailService');
const { smsService } = require('../../services/smsService');
const { validationResult } = require('express-validator');

const notificationController = {
  // Create notification
  createNotification: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const {
        title,
        message,
        type,
        priority,
        targetUsers,
        targetRoles,
        sendEmail,
        sendSMS,
        scheduledFor
      } = req.body;

      // Determine recipients
      let recipients = [];
      if (targetUsers && targetUsers.length > 0) {
        recipients = targetUsers;
      } else if (targetRoles && targetRoles.length > 0) {
        const users = await User.find({ role: { $in: targetRoles } }).select('_id');
        recipients = users.map(user => user._id);
      }

      const notification = new Notification({
        title,
        message,
        type: type || 'general',
        priority: priority || 'medium',
        recipients,
        createdBy: req.user.id,
        scheduledFor: scheduledFor || new Date(),
        status: 'scheduled'
      });

      await notification.save();

      // Send notifications immediately if not scheduled for future
      if (!scheduledFor || new Date(scheduledFor) <= new Date()) {
        await notificationService.sendNotification(notification, sendEmail, sendSMS);
      }

      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: notification
      });
    } catch (error) {
      console.error('Create notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get user notifications
  getUserNotifications: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, unreadOnly } = req.query;

      const filter = {
        $or: [
          { recipients: userId },
          { targetRoles: req.user.role },
          { targetUsers: 'all' }
        ]
      };

      if (unreadOnly === 'true') {
        filter.readBy = { $ne: userId };
      }

      const notifications = await Notification.find(filter)
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Notification.countDocuments(filter);

      // Get unread count
      const unreadCount = await Notification.countDocuments({
        ...filter,
        readBy: { $ne: userId }
      });

      res.status(200).json({
        success: true,
        data: {
          notifications,
          unreadCount,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get user notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Mark notification as read
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findByIdAndUpdate(
        id,
        { $addToSet: { readBy: userId } },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Mark all as read
  markAllAsRead: async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await Notification.updateMany(
        {
          $or: [
            { recipients: userId },
            { targetRoles: req.user.role },
            { targetUsers: 'all' }
          ],
          readBy: { $ne: userId }
        },
        { $addToSet: { readBy: userId } }
      );

      res.status(200).json({
        success: true,
        message: `Marked ${result.modifiedCount} notifications as read`,
        data: {
          markedCount: result.modifiedCount
        }
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get notification statistics
  getNotificationStats: async (req, res) => {
    try {
      const stats = await Notification.aggregate([
        {
          $facet: {
            totalByType: [
              {
                $group: {
                  _id: '$type',
                  count: { $sum: 1 }
                }
              }
            ],
            totalByStatus: [
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 }
                }
              }
            ],
            monthlyTrend: [
              {
                $group: {
                  _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { '_id.year': 1, '_id.month': 1 } },
              { $limit: 12 }
            ]
          }
        }
      ]);

      const deliveryStats = await Notification.aggregate([
        {
          $project: {
            emailDelivered: { $cond: [{ $eq: ['$emailStatus', 'delivered'] }, 1, 0] },
            smsDelivered: { $cond: [{ $eq: ['$smsStatus', 'delivered'] }, 1, 0] },
            totalRecipients: { $size: '$recipients' }
          }
        },
        {
          $group: {
            _id: null,
            totalEmailDelivered: { $sum: '$emailDelivered' },
            totalSmsDelivered: { $sum: '$smsDelivered' },
            totalRecipients: { $sum: '$totalRecipients' }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          ...stats[0],
          deliveryStats: deliveryStats[0] || {
            totalEmailDelivered: 0,
            totalSmsDelivered: 0,
            totalRecipients: 0
          }
        }
      });
    } catch (error) {
      console.error('Get notification stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Delete notification
  deleteNotification: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await Notification.findByIdAndDelete(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Update notification
  updateNotification: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const notification = await Notification.findByIdAndUpdate(
        id,
        { ...updateData, updatedBy: req.user.id },
        { new: true, runValidators: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Notification updated successfully',
        data: notification
      });
    } catch (error) {
      console.error('Update notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get single notification
  getNotification: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOne({
        _id: id,
        $or: [
          { recipients: userId },
          { targetRoles: req.user.role },
          { targetUsers: 'all' }
        ]
      }).populate('createdBy', 'firstName lastName');

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      // Mark as read when viewing
      if (!notification.readBy.includes(userId)) {
        notification.readBy.push(userId);
        await notification.save();
      }

      res.status(200).json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error('Get notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading notification',
        error: error.message
      });
    }
  },

  // Get unread notifications only
  getUnreadNotifications: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const filter = {
        $or: [
          { recipients: userId },
          { targetRoles: req.user.role },
          { targetUsers: 'all' }
        ],
        readBy: { $ne: userId }
      };

      const notifications = await Notification.find(filter)
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Notification.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          notifications,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get unread notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading unread notifications',
        error: error.message
      });
    }
  },

  // Get unread count for API
  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user.id;

      const unreadCount = await Notification.countDocuments({
        $or: [
          { recipients: userId },
          { targetRoles: req.user.role },
          { targetUsers: 'all' }
        ],
        readBy: { $ne: userId }
      });

      res.status(200).json({
        success: true,
        data: {
          unreadCount
        }
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting unread count',
        error: error.message
      });
    }
  },

  // Get recent notifications for API
  getRecentNotifications: async (req, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;

      const notifications = await Notification.find({
        $or: [
          { recipients: userId },
          { targetRoles: req.user.role },
          { targetUsers: 'all' }
        ]
      })
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit);

      res.status(200).json({
        success: true,
        data: notifications
      });
    } catch (error) {
      console.error('Get recent notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading recent notifications',
        error: error.message
      });
    }
  }
};

module.exports = notificationController;