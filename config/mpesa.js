const axios = require('axios');
const crypto = require('crypto');
const db = require('./database');

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

  // Generate access token
  async generateAccessToken() {
    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(`${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (3500 * 1000); // Token expires in ~1 hour
      
      return this.accessToken;
    } catch (error) {
      console.error('❌ M-Pesa access token generation failed:', error.response?.data || error.message);
      throw new Error('Failed to generate M-Pesa access token');
    }
  }

  // Get valid access token
  async getValidAccessToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.generateAccessToken();
    }
    return this.accessToken;
  }

  // Generate timestamp
  generateTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[-:]/g, '').split('.')[0];
  }

  // Generate password
  generatePassword() {
    const timestamp = this.generateTimestamp();
    const password = Buffer.from(`${this.businessShortCode}${this.passkey}${timestamp}`).toString('base64');
    return { password, timestamp };
  }

  // Initiate STK Push
  async initiateSTKPush(phone, amount, accountReference, description) {
    try {
      const accessToken = await this.getValidAccessToken();
      const { password, timestamp } = this.generatePassword();
      
      const phoneNumber = phone.startsWith('+') ? phone : `+${phone}`;
      const formattedPhone = phoneNumber.replace('+', '');

      const requestData = {
        BusinessShortCode: this.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: this.businessShortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: accountReference,
        TransactionDesc: description
      };

      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.ResponseCode === '0') {
        return {
          success: true,
          checkoutRequestID: response.data.CheckoutRequestID,
          customerMessage: response.data.CustomerMessage,
          response: response.data
        };
      } else {
        throw new Error(response.data.ResponseDescription || 'STK push failed');
      }
    } catch (error) {
      console.error('❌ M-Pesa STK Push failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || error.message
      };
    }
  }

  // Handle M-Pesa callback
  async handleCallback(callbackData) {
    try {
      const body = callbackData.Body;
      const stkCallback = body.stkCallback;
      
      if (stkCallback.ResultCode === 0) {
        // Payment successful
        const metadata = stkCallback.CallbackMetadata;
        const items = metadata.Item;
        
        let amount, mpesaReceiptNumber, transactionDate, phoneNumber;

        items.forEach(item => {
          if (item.Name === 'Amount') amount = item.Value;
          if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
          if (item.Name === 'TransactionDate') transactionDate = item.Value;
          if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
        });

        return {
          success: true,
          receipt: mpesaReceiptNumber,
          amount: amount,
          phone: phoneNumber,
          transactionDate: transactionDate
        };
      } else {
        return { 
          success: false, 
          error: stkCallback.ResultDesc 
        };
      }
    } catch (error) {
      console.error('❌ M-Pesa callback handling failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MpesaService();