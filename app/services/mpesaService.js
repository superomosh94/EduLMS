const axios = require('axios');
const crypto = require('crypto');
const db = require('../../config/database');
const Payment = require('../models/Payment');
const { Generators, Validators } = require('../utils');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.businessShortCode = process.env.MPESA_BUSINESS_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
    this.baseURL = this.environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
    
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Generate access token for M-Pesa API
   */
  async generateAccessToken() {
    try {
      console.log('🔑 Generating M-Pesa access token...');
      
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(
        `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        this.tokenExpiry = Date.now() + (3500 * 1000); // Token expires in ~58 minutes
        
        console.log('✅ M-Pesa access token generated successfully');
        return this.accessToken;
      } else {
        throw new Error('Failed to generate access token: No token in response');
      }
    } catch (error) {
      console.error('❌ M-Pesa access token generation failed:', error.response?.data || error.message);
      throw new Error(`M-Pesa authentication failed: ${error.response?.data?.errorMessage || error.message}`);
    }
  }

  /**
   * Get valid access token (renews if expired)
   */
  async getValidAccessToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.generateAccessToken();
    }
    return this.accessToken;
  }

  /**
   * Generate timestamp for M-Pesa API
   */
  generateTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[-:.]/g, '').slice(0, 14);
  }

  /**
   * Generate password for M-Pesa API
   */
  generatePassword() {
    const timestamp = this.generateTimestamp();
    const dataToEncode = `${this.businessShortCode}${this.passkey}${timestamp}`;
    const password = Buffer.from(dataToEncode).toString('base64');
    return { password, timestamp };
  }

  /**
   * Initiate STK Push payment
   */
  async initiateSTKPush(phone, amount, accountReference, description) {
    try {
      console.log(`💰 Initiating STK Push for ${phone}, Amount: ${amount}`);
      
      // Validate inputs
      if (!Validators.isValidPhone(phone)) {
        throw new Error('Invalid phone number format');
      }

      if (!Validators.isValidAmount(amount)) {
        throw new Error('Invalid amount');
      }

      const accessToken = await this.getValidAccessToken();
      const { password, timestamp } = this.generatePassword();
      
      // Format phone number
      const formattedPhone = Validators.formatPhone(phone);
      const cleanPhone = formattedPhone.replace('+', '');

      const requestData = {
        BusinessShortCode: this.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: cleanPhone,
        PartyB: this.businessShortCode,
        PhoneNumber: cleanPhone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: accountReference.substring(0, 12), // Max 12 characters
        TransactionDesc: description.substring(0, 13) // Max 13 characters
      };

      console.log('📤 Sending STK Push request:', {
        ...requestData,
        Password: '***' // Hide password in logs
      });

      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('📥 STK Push response:', response.data);

      if (response.data.ResponseCode === '0') {
        // Success
        return {
          success: true,
          checkoutRequestID: response.data.CheckoutRequestID,
          customerMessage: response.data.CustomerMessage,
          merchantRequestID: response.data.MerchantRequestID,
          responseDescription: response.data.ResponseDescription,
          response: response.data
        };
      } else {
        // STK Push failed
        throw new Error(response.data.ResponseDescription || 'STK push failed');
      }
    } catch (error) {
      console.error('❌ STK Push initiation failed:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.errorMessage || error.message,
        errorCode: error.response?.data?.errorCode,
        requestId: error.response?.data?.requestId
      };
    }
  }

  /**
   * Handle M-Pesa callback
   */
  async handleCallback(callbackData) {
    try {
      console.log('📞 Received M-Pesa callback:', JSON.stringify(callbackData, null, 2));

      const body = callbackData.Body;
      const stkCallback = body.stkCallback;

      if (!stkCallback) {
        throw new Error('Invalid callback data: Missing stkCallback');
      }

      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;
      const checkoutRequestID = stkCallback.CheckoutRequestID;
      const merchantRequestID = stkCallback.MerchantRequestID;

      // Log callback receipt
      await this.logCallback(callbackData);

      if (parseInt(resultCode) === 0) {
        // Payment successful
        const metadata = stkCallback.CallbackMetadata;
        
        if (!metadata || !metadata.Item) {
          throw new Error('Invalid callback data: Missing metadata');
        }

        const items = metadata.Item;
        let amount, mpesaReceiptNumber, transactionDate, phoneNumber;

        items.forEach(item => {
          if (item.Name === 'Amount') amount = item.Value;
          if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
          if (item.Name === 'TransactionDate') transactionDate = item.Value;
          if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
        });

        if (!mpesaReceiptNumber) {
          throw new Error('Missing M-Pesa receipt number in callback');
        }

        console.log('✅ Payment successful:', {
          receipt: mpesaReceiptNumber,
          amount: amount,
          phone: phoneNumber,
          transactionDate: transactionDate
        });

        // Update payment status in database
        await this.updatePaymentStatus(
          checkoutRequestID,
          'completed',
          mpesaReceiptNumber,
          amount,
          phoneNumber,
          transactionDate
        );

        return {
          success: true,
          receipt: mpesaReceiptNumber,
          amount: amount,
          phone: phoneNumber,
          transactionDate: transactionDate,
          checkoutRequestID: checkoutRequestID,
          merchantRequestID: merchantRequestID
        };
      } else {
        // Payment failed
        console.log('❌ Payment failed:', {
          resultCode: resultCode,
          resultDesc: resultDesc,
          checkoutRequestID: checkoutRequestID
        });

        // Update payment status to failed
        await this.updatePaymentStatus(
          checkoutRequestID,
          'failed',
          null,
          null,
          null,
          null,
          resultDesc
        );

        return {
          success: false,
          error: resultDesc,
          resultCode: resultCode,
          checkoutRequestID: checkoutRequestID
        };
      }
    } catch (error) {
      console.error('❌ M-Pesa callback handling failed:', error);
      
      // Log error
      await this.logError('callback_handling', error.message, callbackData);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update payment status in database
   */
  async updatePaymentStatus(checkoutRequestID, status, receiptNumber = null, amount = null, phone = null, transactionDate = null, failureReason = null) {
    try {
      // Find payment by checkout request ID
      const payments = await db.query(
        'SELECT * FROM payments WHERE checkout_request_id = ?',
        [checkoutRequestID]
      );

      if (payments.length === 0) {
        console.error('❌ Payment not found for checkout request ID:', checkoutRequestID);
        return false;
      }

      const payment = payments[0];
      const updateData = {
        status: status,
        updated_at: new Date()
      };

      if (status === 'completed') {
        updateData.mpesa_receipt = receiptNumber;
        updateData.transaction_date = transactionDate ? new Date(transactionDate) : new Date();
        updateData.payer_phone = phone;
        updateData.verified_at = new Date();
        updateData.verified_by = 'system';
      } else if (status === 'failed') {
        updateData.failure_reason = failureReason;
        updateData.failed_at = new Date();
      }

      await db.query(
        'UPDATE payments SET ? WHERE id = ?',
        [updateData, payment.id]
      );

      console.log(`✅ Payment ${payment.id} updated to status: ${status}`);

      // If payment is completed, update student fee balance
      if (status === 'completed') {
        await this.updateStudentBalance(payment.student_id, payment.amount);
      }

      return true;
    } catch (error) {
      console.error('❌ Error updating payment status:', error);
      throw error;
    }
  }

  /**
   * Update student fee balance after successful payment
   */
  async updateStudentBalance(studentId, amount) {
    try {
      // Get current student balance
      const students = await db.query(
        'SELECT fee_balance FROM students WHERE user_id = ?',
        [studentId]
      );

      if (students.length === 0) {
        console.error('❌ Student not found:', studentId);
        return;
      }

      const currentBalance = parseFloat(students[0].fee_balance) || 0;
      const newBalance = Math.max(0, currentBalance - parseFloat(amount));

      await db.query(
        'UPDATE students SET fee_balance = ?, updated_at = NOW() WHERE user_id = ?',
        [newBalance, studentId]
      );

      console.log(`✅ Updated student ${studentId} balance: ${currentBalance} -> ${newBalance}`);
    } catch (error) {
      console.error('❌ Error updating student balance:', error);
      // Don't throw error as this shouldn't fail the main payment process
    }
  }

  /**
   * Query transaction status
   */
  async queryTransactionStatus(checkoutRequestID) {
    try {
      const accessToken = await this.getValidAccessToken();
      const { password, timestamp } = this.generatePassword();

      const requestData = {
        BusinessShortCode: this.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID
      };

      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpushquery/v1/query`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.ResponseCode === '0') {
        return {
          success: true,
          resultCode: response.data.ResultCode,
          resultDesc: response.data.ResultDesc,
          response: response.data
        };
      } else {
        return {
          success: false,
          error: response.data.ResponseDescription,
          response: response.data
        };
      }
    } catch (error) {
      console.error('❌ Transaction query failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || error.message
      };
    }
  }

  /**
   * Process bulk payments
   */
  async processBulkPayments(payments) {
    const results = [];
    
    for (const payment of payments) {
      try {
        const result = await this.initiateSTKPush(
          payment.phone,
          payment.amount,
          payment.accountReference,
          payment.description
        );
        
        results.push({
          paymentId: payment.id,
          success: result.success,
          checkoutRequestID: result.checkoutRequestID,
          error: result.error
        });
        
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          paymentId: payment.id,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Log callback for audit purposes
   */
  async logCallback(callbackData) {
    try {
      await db.query(
        `INSERT INTO mpesa_callbacks 
         (callback_data, received_at) 
         VALUES (?, NOW())`,
        [JSON.stringify(callbackData)]
      );
    } catch (error) {
      console.error('❌ Error logging callback:', error);
    }
  }

  /**
   * Log errors for monitoring
   */
  async logError(errorType, errorMessage, context = null) {
    try {
      await db.query(
        `INSERT INTO mpesa_errors 
         (error_type, error_message, context, occurred_at) 
         VALUES (?, ?, ?, NOW())`,
        [errorType, errorMessage, context ? JSON.stringify(context) : null]
      );
    } catch (error) {
      console.error('❌ Error logging M-Pesa error:', error);
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(startDate, endDate) {
    try {
      const stats = await db.query(
        `SELECT 
          status,
          COUNT(*) as count,
          SUM(amount) as total_amount
         FROM payments 
         WHERE created_at BETWEEN ? AND ?
         GROUP BY status`,
        [startDate, endDate]
      );

      const dailyStats = await db.query(
        `SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(amount) as total_amount
         FROM payments 
         WHERE status = 'completed' AND created_at BETWEEN ? AND ?
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
        [startDate, endDate]
      );

      return {
        summary: stats,
        daily: dailyStats
      };
    } catch (error) {
      console.error('❌ Error getting payment stats:', error);
      throw error;
    }
  }

  /**
   * Validate M-Pesa receipt number
   */
  validateReceiptNumber(receipt) {
    return /^[A-Z0-9]{10}$/.test(receipt);
  }

  /**
   * Format transaction date from M-Pesa format
   */
  formatTransactionDate(mpesaDate) {
    if (!mpesaDate) return null;
    
    // M-Pesa date format: YYYYMMDDHHmmss
    if (mpesaDate.length === 14) {
      const year = mpesaDate.substring(0, 4);
      const month = mpesaDate.substring(4, 6);
      const day = mpesaDate.substring(6, 8);
      const hour = mpesaDate.substring(8, 10);
      const minute = mpesaDate.substring(10, 12);
      const second = mpesaDate.substring(12, 14);
      
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    }
    
    return new Date(mpesaDate);
  }
}

module.exports = new MpesaService();