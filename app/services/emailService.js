const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const { Helpers, Formatters } = require('../utils');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = {};
    this.initializeTransporter();
    this.loadTemplates();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_PORT == 465,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Email transporter verification failed:', error);
        } else {
          console.log('✅ Email transporter is ready');
        }
      });
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
    }
  }

  /**
   * Load email templates
   */
  loadTemplates() {
    const templatesDir = path.join(__dirname, '../../templates/emails');
    
    try {
      if (fs.existsSync(templatesDir)) {
        const templateFiles = fs.readdirSync(templatesDir);
        
        templateFiles.forEach(file => {
          if (file.endsWith('.html')) {
            const templateName = path.basename(file, '.html');
            const templatePath = path.join(templatesDir, file);
            const templateContent = fs.readFileSync(templatePath, 'utf8');
            
            this.templates[templateName] = handlebars.compile(templateContent);
            console.log(`✅ Loaded email template: ${templateName}`);
          }
        });
      } else {
        console.log('ℹ️  No email templates directory found, using default templates');
      }
    } catch (error) {
      console.error('❌ Error loading email templates:', error);
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(user, password = null) {
    const subject = `Welcome to ${process.env.SITE_NAME || 'EduLMS'}`;
    
    const templateData = {
      siteName: process.env.SITE_NAME || 'EduLMS',
      userName: Formatters.formatName(user.first_name, user.last_name),
      userEmail: user.email,
      password: password,
      loginUrl: `${process.env.APP_URL}/auth/login`,
      supportEmail: process.env.SUPPORT_EMAIL,
      currentYear: new Date().getFullYear()
    };

    return this.sendEmail(
      user.email,
      subject,
      'welcome',
      templateData
    );
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetToken) {
    const subject = 'Password Reset Request';
    const resetUrl = `${process.env.APP_URL}/auth/reset-password?token=${resetToken}`;

    const templateData = {
      siteName: process.env.SITE_NAME || 'EduLMS',
      userName: Formatters.formatName(user.first_name, user.last_name),
      resetUrl: resetUrl,
      expiryHours: 1, // Token expires in 1 hour
      supportEmail: process.env.SUPPORT_EMAIL,
      currentYear: new Date().getFullYear()
    };

    return this.sendEmail(
      user.email,
      subject,
      'password-reset',
      templateData
    );
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(payment, student, invoiceUrl = null) {
    const subject = 'Payment Confirmation';

    const templateData = {
      siteName: process.env.SITE_NAME || 'EduLMS',
      userName: Formatters.formatName(student.first_name, student.last_name),
      amount: Helpers.formatCurrency(payment.amount),
      paymentDate: Helpers.formatDateTime(payment.created_at),
      receiptNumber: payment.mpesa_receipt || payment.id.toString(),
      invoiceUrl: invoiceUrl,
      supportEmail: process.env.SUPPORT_EMAIL,
      currentYear: new Date().getFullYear()
    };

    return this.sendEmail(
      student.email,
      subject,
      'payment-confirmation',
      templateData
    );
  }

  /**
   * Send assignment notification
   */
  async sendAssignmentNotification(assignment, students, course) {
    const subject = `New Assignment: ${assignment.title}`;

    const emails = students.map(student => ({
      email: student.email,
      data: {
        siteName: process.env.SITE_NAME || 'EduLMS',
        userName: Formatters.formatName(student.first_name, student.last_name),
        assignmentTitle: assignment.title,
        courseName: course.title,
        dueDate: Helpers.formatDateTime(assignment.due_date),
        totalPoints: assignment.total_points,
        assignmentUrl: `${process.env.APP_URL}/student/assignments/${assignment.id}`,
        supportEmail: process.env.SUPPORT_EMAIL,
        currentYear: new Date().getFullYear()
      }
    }));

    return this.sendBulkEmail(
      emails,
      subject,
      'assignment-notification'
    );
  }

  /**
   * Send grade notification
   */
  async sendGradeNotification(grade, student, assignment, course) {
    const subject = `Grade Posted: ${assignment.title}`;

    const templateData = {
      siteName: process.env.SITE_NAME || 'EduLMS',
      userName: Formatters.formatName(student.first_name, student.last_name),
      assignmentTitle: assignment.title,
      courseName: course.title,
      score: grade.score,
      totalPoints: assignment.total_points,
      grade: grade.grade,
      feedback: grade.feedback,
      assignmentUrl: `${process.env.APP_URL}/student/grades`,
      supportEmail: process.env.SUPPORT_EMAIL,
      currentYear: new Date().getFullYear()
    };

    return this.sendEmail(
      student.email,
      subject,
      'grade-notification',
      templateData
    );
  }

  /**
   * Send enrollment confirmation
   */
  async sendEnrollmentConfirmation(enrollment, student, course) {
    const subject = `Enrollment Confirmation: ${course.title}`;

    const templateData = {
      siteName: process.env.SITE_NAME || 'EduLMS',
      userName: Formatters.formatName(student.first_name, student.last_name),
      courseTitle: course.title,
      courseCode: course.code,
      instructorName: Formatters.formatName(course.instructor_first_name, course.instructor_last_name),
      startDate: Helpers.formatDate(course.start_date),
      endDate: Helpers.formatDate(course.end_date),
      credits: course.credits,
      courseUrl: `${process.env.APP_URL}/student/courses/${course.id}`,
      supportEmail: process.env.SUPPORT_EMAIL,
      currentYear: new Date().getFullYear()
    };

    return this.sendEmail(
      student.email,
      subject,
      'enrollment-confirmation',
      templateData
    );
  }

  /**
   * Send system notification
   */
  async sendSystemNotification(users, notification) {
    const subject = notification.title;

    const emails = users.map(user => ({
      email: user.email,
      data: {
        siteName: process.env.SITE_NAME || 'EduLMS',
        userName: Formatters.formatName(user.first_name, user.last_name),
        notificationTitle: notification.title,
        notificationMessage: notification.message,
        notificationUrl: notification.url,
        supportEmail: process.env.SUPPORT_EMAIL,
        currentYear: new Date().getFullYear()
      }
    }));

    return this.sendBulkEmail(
      emails,
      subject,
      'system-notification'
    );
  }

  /**
   * Send invoice email
   */
  async sendInvoiceEmail(invoice, student, items, pdfBuffer = null) {
    const subject = `Invoice #${invoice.invoice_number}`;

    const templateData = {
      siteName: process.env.SITE_NAME || 'EduLMS',
      userName: Formatters.formatName(student.first_name, student.last_name),
      invoiceNumber: invoice.invoice_number,
      invoiceDate: Helpers.formatDate(invoice.created_at),
      dueDate: Helpers.formatDate(invoice.due_date),
      totalAmount: Helpers.formatCurrency(invoice.total_amount),
      items: items,
      supportEmail: process.env.SUPPORT_EMAIL,
      currentYear: new Date().getFullYear()
    };

    const attachments = [];
    
    if (pdfBuffer) {
      attachments.push({
        filename: `invoice-${invoice.invoice_number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    return this.sendEmail(
      student.email,
      subject,
      'invoice',
      templateData,
      attachments
    );
  }

  /**
   * Send low balance alert
   */
  async sendLowBalanceAlert(student, currentBalance, minimumBalance = 0) {
    const subject = 'Low Account Balance Alert';

    const templateData = {
      siteName: process.env.SITE_NAME || 'EduLMS',
      userName: Formatters.formatName(student.first_name, student.last_name),
      currentBalance: Helpers.formatCurrency(currentBalance),
      minimumBalance: Helpers.formatCurrency(minimumBalance),
      paymentUrl: `${process.env.APP_URL}/student/payments/make-payment`,
      supportEmail: process.env.SUPPORT_EMAIL,
      currentYear: new Date().getFullYear()
    };

    return this.sendEmail(
      student.email,
      subject,
      'low-balance-alert',
      templateData
    );
  }

  /**
   * Send custom email
   */
  async sendCustomEmail(to, subject, message, attachments = []) {
    const templateData = {
      siteName: process.env.SITE_NAME || 'EduLMS',
      message: message,
      currentYear: new Date().getFullYear()
    };

    return this.sendEmail(
      to,
      subject,
      'custom',
      templateData,
      attachments
    );
  }

  /**
   * Generic email sending method
   */
  async sendEmail(to, subject, templateName, data, attachments = []) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      // Get template
      let html;
      if (this.templates[templateName]) {
        html = this.templates[templateName](data);
      } else {
        // Fallback to simple template
        html = this.getFallbackTemplate(templateName, data);
      }

      const mailOptions = {
        from: {
          name: process.env.SITE_NAME || 'EduLMS',
          address: process.env.EMAIL_USER
        },
        to: to,
        subject: subject,
        html: html,
        attachments: attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${to}: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmail(emails, subject, templateName, attachments = []) {
    const results = [];
    
    for (const email of emails) {
      try {
        const result = await this.sendEmail(
          email.email,
          subject,
          templateName,
          email.data,
          attachments
        );
        
        results.push({
          email: email.email,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          email: email.email,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Get fallback template when template file is not found
   */
  getFallbackTemplate(templateName, data) {
    const baseTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { background: #f8f9fa; padding: 20px; }
          .footer { background: #34495e; color: white; padding: 10px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>{{siteName}}</h1>
          </div>
          <div class="content">
            {{#if userName}}<p>Dear {{userName}},</p>{{/if}}
            {{{content}}}
          </div>
          <div class="footer">
            <p>&copy; {{currentYear}} {{siteName}}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    let content = '';
    
    switch (templateName) {
      case 'welcome':
        content = `
          <p>Welcome to {{siteName}}! Your account has been successfully created.</p>
          {{#if password}}<p>Your temporary password is: <strong>{{password}}</strong></p>{{/if}}
          <p>You can login to your account here: <a href="{{loginUrl}}">{{loginUrl}}</a></p>
          <p>If you have any questions, please contact our support team at {{supportEmail}}.</p>
        `;
        break;
        
      case 'password-reset':
        content = `
          <p>You have requested to reset your password.</p>
          <p>Click the link below to reset your password (expires in {{expiryHours}} hour):</p>
          <p><a href="{{resetUrl}}">Reset Password</a></p>
          <p>If you didn't request this, please ignore this email.</p>
        `;
        break;
        
      default:
        content = '<p>This is an automated message from {{siteName}}.</p>';
    }
    
    const template = handlebars.compile(baseTemplate);
    return template({
      ...data,
      content: content
    });
  }

  /**
   * Get email delivery status
   */
  async getDeliveryStatus(messageId) {
    // This would typically query the email service provider's API
    // For now, we'll return a mock response
    return {
      delivered: true,
      status: 'delivered',
      timestamp: new Date()
    };
  }

  /**
   * Test email configuration
   */
  async testConfiguration() {
    try {
      if (!this.transporter) {
        return { success: false, error: 'Transporter not initialized' };
      }

      await this.transporter.verify();
      
      // Send test email
      const testResult = await this.sendEmail(
        process.env.EMAIL_USER,
        'Test Email - EduLMS',
        'custom',
        { message: 'This is a test email from EduLMS system.' }
      );

      return {
        success: testResult.success,
        error: testResult.error,
        message: testResult.success ? 'Email configuration is working correctly' : 'Email sending failed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();