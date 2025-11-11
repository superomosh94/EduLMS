const SystemSetting = require('../../models/SystemSetting');
const AuditLog = require('../../models/AuditLog');
const { validationResult } = require('express-validator');

const settingController = {
  // Get all system settings
  getSystemSettings: async (req, res) => {
    try {
      const { category, page = 1, limit = 100 } = req.query;
      const filter = {};

      if (category) filter.category = category;

      const settings = await SystemSetting.find(filter)
        .populate('updatedBy', 'firstName lastName')
        .sort({ category: 1, key: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await SystemSetting.countDocuments(filter);

      // Group settings by category for easier consumption
      const settingsByCategory = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        acc[setting.category].push(setting);
        return acc;
      }, {});

      res.status(200).json({
        success: true,
        data: {
          settings,
          settingsByCategory,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get system setting by key
  getSystemSetting: async (req, res) => {
    try {
      const { key } = req.params;

      const setting = await SystemSetting.findOne({ key })
        .populate('updatedBy', 'firstName lastName');

      if (!setting) {
        return res.status(404).json({
          success: false,
          message: 'System setting not found'
        });
      }

      res.status(200).json({
        success: true,
        data: setting
      });
    } catch (error) {
      console.error('Get system setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Update system setting
  updateSystemSetting: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { key } = req.params;
      const { value, dataType, description } = req.body;

      let setting = await SystemSetting.findOne({ key });

      if (!setting) {
        // Create new setting if it doesn't exist
        setting = new SystemSetting({
          key,
          value,
          dataType: dataType || typeof value,
          description: description || '',
          updatedBy: req.user.id
        });
      } else {
        // Update existing setting
        setting.value = value;
        if (dataType) setting.dataType = dataType;
        if (description) setting.description = description;
        setting.updatedBy = req.user.id;
      }

      await setting.save();

      // Log the setting change
      await AuditLog.create({
        action: 'update',
        resource: 'system_setting',
        user: req.user.id,
        description: `Updated system setting: ${key}`,
        status: 'success',
        details: {
          key,
          oldValue: setting._doc._original?.value,
          newValue: value
        }
      });

      res.status(200).json({
        success: true,
        message: 'System setting updated successfully',
        data: setting
      });
    } catch (error) {
      console.error('Update system setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Update multiple system settings
  updateMultipleSettings: async (req, res) => {
    try {
      const { settings } = req.body;

      if (!settings || !Array.isArray(settings)) {
        return res.status(400).json({
          success: false,
          message: 'Settings array is required'
        });
      }

      const updateResults = [];
      const errors = [];

      for (const settingData of settings) {
        try {
          const { key, value, dataType, description } = settingData;

          let setting = await SystemSetting.findOne({ key });

          if (!setting) {
            setting = new SystemSetting({
              key,
              value,
              dataType: dataType || typeof value,
              description: description || '',
              updatedBy: req.user.id
            });
          } else {
            setting.value = value;
            if (dataType) setting.dataType = dataType;
            if (description) setting.description = description;
            setting.updatedBy = req.user.id;
          }

          await setting.save();
          updateResults.push(setting);

          // Log each setting change
          await AuditLog.create({
            action: 'update',
            resource: 'system_setting',
            user: req.user.id,
            description: `Updated system setting: ${key}`,
            status: 'success',
            details: {
              key,
              newValue: value
            }
          });

        } catch (error) {
          errors.push({
            key: settingData.key,
            error: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `Updated ${updateResults.length} settings${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
        data: {
          updated: updateResults,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (error) {
      console.error('Update multiple settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get settings by category
  getSettingsByCategory: async (req, res) => {
    try {
      const { category } = req.params;

      const settings = await SystemSetting.find({ category })
        .populate('updatedBy', 'firstName lastName')
        .sort({ key: 1 });

      res.status(200).json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Get settings by category error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get system configuration
  getSystemConfig: async (req, res) => {
    try {
      const settings = await SystemSetting.find({});
      
      const config = settings.reduce((acc, setting) => {
        // Convert value based on data type
        let value = setting.value;
        if (setting.dataType === 'number') {
          value = Number(value);
        } else if (setting.dataType === 'boolean') {
          value = value === 'true' || value === true;
        } else if (setting.dataType === 'json') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            value = setting.value;
          }
        } else if (setting.dataType === 'array') {
          try {
            value = JSON.parse(value);
            if (!Array.isArray(value)) value = [value];
          } catch (e) {
            value = [setting.value];
          }
        }

        acc[setting.key] = value;
        return acc;
      }, {});

      res.status(200).json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Get system config error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Reset setting to default
  resetSetting: async (req, res) => {
    try {
      const { key } = req.params;

      const setting = await SystemSetting.findOne({ key });
      if (!setting) {
        return res.status(404).json({
          success: false,
          message: 'System setting not found'
        });
      }

      if (!setting.defaultValue) {
        return res.status(400).json({
          success: false,
          message: 'No default value defined for this setting'
        });
      }

      const oldValue = setting.value;
      setting.value = setting.defaultValue;
      setting.updatedBy = req.user.id;
      await setting.save();

      // Log the reset action
      await AuditLog.create({
        action: 'reset',
        resource: 'system_setting',
        user: req.user.id,
        description: `Reset system setting: ${key} to default`,
        status: 'success',
        details: {
          key,
          oldValue,
          newValue: setting.defaultValue
        }
      });

      res.status(200).json({
        success: true,
        message: 'System setting reset to default successfully',
        data: setting
      });
    } catch (error) {
      console.error('Reset setting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get system health
  getSystemHealth: async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        checks: {}
      };

      // Database connection check
      try {
        const dbCheck = await SystemSetting.findOne({});
        health.checks.database = {
          status: 'healthy',
          responseTime: Date.now() - health.timestamp.getTime()
        };
      } catch (error) {
        health.checks.database = {
          status: 'unhealthy',
          error: error.message
        };
        health.status = 'degraded';
      }

      // Storage check
      try {
        const fs = require('fs');
        const path = require('path');
        
        const uploadDir = path.join(__dirname, '../../public/uploads');
        const tempDir = path.join(__dirname, '../../storage/temp');
        
        health.checks.storage = {
          status: 'healthy',
          uploads: {
            exists: fs.existsSync(uploadDir),
            writable: true // We'll assume it's writable for now
          },
          temp: {
            exists: fs.existsSync(tempDir),
            writable: true
          }
        };
      } catch (error) {
        health.checks.storage = {
          status: 'unhealthy',
          error: error.message
        };
        health.status = 'degraded';
      }

      // External services check (M-Pesa, Email, etc.)
      health.checks.externalServices = {
        mpesa: { status: 'unknown' },
        email: { status: 'unknown' },
        sms: { status: 'unknown' }
      };

      res.status(200).json({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('Get system health error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = settingController;