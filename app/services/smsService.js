const axios = require('axios');
const { Validators, Formatters } = require('../utils');

class SMSService {
  constructor() {
    this.apiKey = process.env.SMS_API_KEY;
    this.apiSecret = process.env.SMS_API_SECRET;
    this.senderId = process.env.SMS_SENDER_ID || 'EduLMS';
    this.provider = process.env.SMS_PROVIDER || 'africastalking'; // africastalking, twilio, etc.
  }

  /**
   * Send SMS message
   */
  async sendSMS(phone, message, options = {}) {
    try {
      // Validate phone number
      if (!Validators.isValidPhone(phone)) {
        throw new Error('Invalid phone number format');
      }

      // Format phone number
      const formattedPhone = Validators.formatPhone(phone);

      // Truncate message if too long
      const truncatedMessage = message.length > 160 
        ? message.substring(0, 157) + '...' 
        : message;

      let result;

      switch (this.provider.toLowerCase()) {
        case 'africastalking':
          result = await this.sendViaAfricaTalking(formattedPhone, truncatedMessage, options);
          break;
        case 'twilio':
          result = await this.sendViaTwilio(formattedPhone, truncatedMessage, options);
          break;
        default:
          result = await this.sendViaGeneric(formattedPhone, truncatedMessage, options);
      }

      // Log SMS delivery
      await this.logSMSDelivery({
        phone: formattedPhone,
        message: truncatedMessage,
        provider: this.provider,
        success: result.success,
        messageId: result.messageId,
        error: result.error
      });

      return result;

    } catch (error) {
      console.error('❌ SMS sending failed:', error);
      
      await this.logSMSDelivery({
        phone: phone,
        message: message,
        provider: this.provider,
        success: false,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send SMS via Africa's Talking
   */
  async sendViaAfricaTalking(phone, message, options = {}) {
    try {
      const response = await axios.post(
        'https://api.africastalking.com/version1/messaging',
        new URLSearchParams({
          username: process.env.AT_USERNAME,
          to: phone,
          message: message,
          from: this.senderId
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'apiKey': this.apiKey,
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.SMSMessageData.Recipients[0].status === 'Success') {
        return {
          success: true,
          messageId: response.data.SMSMessageData.Recipients[0].messageId,
          provider: 'africastalking',
          cost: response.data.SMSMessageData.Recipients[0].cost
        };
      } else {
        throw new Error(response.data.SMSMessageData.Recipients[0].status);
      }
    } catch (error) {
      throw new Error(`Africa's Talking API error: ${error.response?.data?.SMSMessageData?.Message || error.message}`);
    }
  }

  /**
   * Send SMS via Twilio
   */
  async sendViaTwilio(phone, message, options = {}) {
    try {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      const response = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      return {
        success: true,
        messageId: response.sid,
        provider: 'twilio',
        status: response.status
      };
    } catch (error) {
      throw new Error(`Twilio API error: ${error.message}`);
    }
  }

  /**
   * Send SMS via generic HTTP API
   */
  async sendViaGeneric(phone, message, options = {}) {
    try {
      // This is a generic implementation that can be adapted for any SMS provider
      const response = await axios.post(
        process.env.SMS_API_URL,
        {
          api_key: this.apiKey,
          api_secret: this.apiSecret,
          to: phone,
          from: this.senderId,
          message: message,
          ...options
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.success) {
        return {
          success: true,
          messageId: response.data.message_id,
          provider: 'generic',
          response: response.data
        };
      } else {
        throw new Error(response.data.error || 'Unknown error from SMS provider');
      }
    } catch (error) {
      throw new Error(`Generic SMS API error: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(recipients, message, options = {}) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.sendSMS(recipient.phone, message, options);
        
        results.push({
          phone: recipient.phone,
          name: recipient.name,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          phone: recipient.phone,
          name: recipient.name,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Send payment reminder SMS
   */
  async sendPaymentReminder(student, amount, dueDate) {
    const message = `Dear ${student.first_name}, your fee balance of ${Formatters.formatCurrency(amount)} is due on ${Formatters.formatDate(dueDate)}. Please make payment to avoid penalties.`;
    
    return this.sendSMS(student.phone, message);
  }

  /**
   * Send assignment reminder SMS
   */
  async sendAssignmentReminder(student, assignment, course) {
    const message = `Reminder: Assignment "${assignment.title}" for ${course.title} is due on ${Formatters.formatDateTime(assignment.due_date)}.`;
    
    return this.sendSMS(student.phone, message);
  }

  /**
   * Send emergency alert SMS
   */
  async sendEmergencyAlert(students, message) {
    const recipients = students.map(student => ({
      phone: student.phone,
      name: Formatters.formatName(student.first_name, student.last_name)
    }));
    
    const emergencyMessage = `URGENT: ${message}`;
    
    return this.sendBulkSMS(recipients, emergencyMessage);
  }

  /**
   * Send OTP verification SMS
   */
  async sendOTP(phone, otp) {
    const message = `Your verification code is: ${otp}. This code expires in 10 minutes.`;
    
    return this.sendSMS(phone, message);
  }

  /**
   * Log SMS delivery for audit purposes
   */
  async logSMSDelivery(deliveryData) {
    try {
      const db = require('../../config/database');
      
      await db.query(
        `INSERT INTO sms_logs 
         (phone, message, provider, success, message_id, error, sent_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          deliveryData.phone,
          deliveryData.message,
          deliveryData.provider,
          deliveryData.success,
          deliveryData.messageId,
          deliveryData.error
        ]
      );
    } catch (error) {
      console.error('❌ Error logging SMS delivery:', error);
    }
  }

  /**
   * Get SMS delivery status
   */
  async getDeliveryStatus(messageId) {
    try {
      // This would typically query the SMS provider's API
      // For now, we'll return a mock response
      const db = require('../../config/database');
      
      const logs = await db.query(
        'SELECT * FROM sms_logs WHERE message_id = ?',
        [messageId]
      );
      
      if (logs.length === 0) {
        return { success: false, error: 'Message not found' };
      }
      
      const log = logs[0];
      
      return {
        success: log.success,
        status: log.success ? 'delivered' : 'failed',
        deliveredAt: log.sent_at,
        error: log.error
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get SMS usage statistics
   */
  async getUsageStats(startDate, endDate) {
    try {
      const db = require('../../config/database');
      
      const stats = await db.query(`
        SELECT 
          DATE(sent_at) as date,
          provider,
          COUNT(*) as total_sent,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
        FROM sms_logs 
        WHERE sent_at BETWEEN ? AND ?
        GROUP BY DATE(sent_at), provider
        ORDER BY date DESC
      `, [startDate, endDate]);
      
      const totalStats = await db.query(`
        SELECT 
          COUNT(*) as total_sent,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
        FROM sms_logs 
        WHERE sent_at BETWEEN ? AND ?
      `, [startDate, endDate]);
      
      return {
        daily: stats,
        summary: totalStats[0]
      };
    } catch (error) {
      throw new Error(`Failed to get SMS usage stats: ${error.message}`);
    }
  }

  /**
   * Check SMS balance (if supported by provider)
   */
  async checkBalance() {
    try {
      switch (this.provider.toLowerCase()) {
        case 'africastalking':
          return await this.checkAfricaTalkingBalance();
        default:
          return { success: false, error: 'Balance check not supported for this provider' };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check Africa's Talking balance
   */
  async checkAfricaTalkingBalance() {
    try {
      const response = await axios.get(
        'https://api.africastalking.com/version1/user',
        {
          params: {
            username: process.env.AT_USERNAME
          },
          headers: {
            'apiKey': this.apiKey,
            'Accept': 'application/json'
          }
        }
      );

      return {
        success: true,
        balance: response.data.UserData.balance,
        currency: 'KES'
      };
    } catch (error) {
      throw new Error(`Failed to check balance: ${error.response?.data?.errorMessage || error.message}`);
    }
  }

  /**
   * Validate phone number using provider's API
   */
  async validatePhoneNumber(phone) {
    try {
      const formattedPhone = Validators.formatPhone(phone);
      
      // Simple validation - in production, you might use a service like NumVerify
      return {
        valid: Validators.isValidPhone(phone),
        formatted: formattedPhone,
        country: 'KE'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Test SMS service configuration
   */
  async testConfiguration() {
    try {
      const testPhone = process.env.SMS_TEST_PHONE;
      
      if (!testPhone) {
        return { success: false, error: 'Test phone number not configured' };
      }

      const result = await this.sendSMS(
        testPhone,
        'Test SMS from EduLMS system. If you receive this, SMS configuration is working correctly.'
      );

      return {
        success: result.success,
        error: result.error,
        message: result.success ? 'SMS service is working correctly' : 'SMS sending failed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SMSService();