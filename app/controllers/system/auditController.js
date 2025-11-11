const AuditLog = require('../../models/AuditLog');
const User = require('../../models/User');

const auditController = {
  // Get audit logs
  getAuditLogs: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        action,
        resource,
        userId,
        startDate,
        endDate,
        status
      } = req.query;

      const filter = {};

      if (action) filter.action = action;
      if (resource) filter.resource = resource;
      if (userId) filter.user = userId;
      if (status) filter.status = status;

      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
      }

      const auditLogs = await AuditLog.find(filter)
        .populate('user', 'firstName lastName email role')
        .sort({ timestamp: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await AuditLog.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          auditLogs,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get audit log by ID
  getAuditLog: async (req, res) => {
    try {
      const { id } = req.params;

      const auditLog = await AuditLog.findById(id)
        .populate('user', 'firstName lastName email role');

      if (!auditLog) {
        return res.status(404).json({
          success: false,
          message: 'Audit log not found'
        });
      }

      res.status(200).json({
        success: true,
        data: auditLog
      });
    } catch (error) {
      console.error('Get audit log error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get audit statistics
  getAuditStats: async (req, res) => {
    try {
      const { period = '30d' } = req.query;

      let startDate = new Date();
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      const stats = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate }
          }
        },
        {
          $facet: {
            actionsByType: [
              {
                $group: {
                  _id: '$action',
                  count: { $sum: 1 }
                }
              },
              { $sort: { count: -1 } }
            ],
            resourcesByCount: [
              {
                $group: {
                  _id: '$resource',
                  count: { $sum: 1 }
                }
              },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ],
            usersByActivity: [
              {
                $group: {
                  _id: '$user',
                  count: { $sum: 1 }
                }
              },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ],
            dailyActivity: [
              {
                $group: {
                  _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ],
            statusSummary: [
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 }
                }
              }
            ]
          }
        }
      ]);

      const totalStats = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalActions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user' }
          }
        },
        {
          $project: {
            totalActions: 1,
            uniqueUsersCount: { $size: '$uniqueUsers' }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          ...stats[0],
          overview: totalStats[0] || { totalActions: 0, uniqueUsersCount: 0 },
          period: {
            start: startDate,
            end: new Date()
          }
        }
      });
    } catch (error) {
      console.error('Get audit stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Export audit logs
  exportAuditLogs: async (req, res) => {
    try {
      const { format = 'json', startDate, endDate } = req.query;

      const filter = {};
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
      }

      const auditLogs = await AuditLog.find(filter)
        .populate('user', 'firstName lastName email role')
        .sort({ timestamp: -1 });

      if (format === 'csv') {
        const csvData = await convertToCSV(auditLogs);
        
        res.set({
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`
        });

        return res.send(csvData);
      }

      res.status(200).json({
        success: true,
        data: auditLogs,
        metadata: {
          total: auditLogs.length,
          exportedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Export audit logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Clean up old audit logs
  cleanupAuditLogs: async (req, res) => {
    try {
      const { olderThanDays = 365 } = req.body;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await AuditLog.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      // Log the cleanup action
      await AuditLog.create({
        action: 'cleanup',
        resource: 'audit_logs',
        user: req.user.id,
        description: `Cleaned up audit logs older than ${olderThanDays} days`,
        status: 'success',
        details: {
          deletedCount: result.deletedCount,
          cutoffDate: cutoffDate
        }
      });

      res.status(200).json({
        success: true,
        message: `Cleaned up ${result.deletedCount} audit logs older than ${olderThanDays} days`,
        data: {
          deletedCount: result.deletedCount,
          cutoffDate: cutoffDate
        }
      });
    } catch (error) {
      console.error('Cleanup audit logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

// Helper function to convert audit logs to CSV
async function convertToCSV(auditLogs) {
  const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Status', 'Description', 'IP Address'];
  
  const csvRows = auditLogs.map(log => [
    log.timestamp.toISOString(),
    log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
    log.action,
    log.resource,
    log.status,
    `"${log.description.replace(/"/g, '""')}"`,
    log.ipAddress || ''
  ]);

  return [headers, ...csvRows].map(row => row.join(',')).join('\n');
}

module.exports = auditController;