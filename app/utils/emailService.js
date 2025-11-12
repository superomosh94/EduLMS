const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    initializeTransporter() {
        try {
            // Create transporter based on environment
            if (process.env.NODE_ENV === 'production') {
                this.transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: process.env.SMTP_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
            } else {
                // Development - use Ethereal email test service or console logging
                if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
                    this.transporter = nodemailer.createTransport({
                        host: 'smtp.ethereal.email',
                        port: 587,
                        secure: false,
                        auth: {
                            user: process.env.ETHEREAL_USER,
                            pass: process.env.ETHEREAL_PASS
                        }
                    });
                } else {
                    // Fallback to console logging for development
                    this.transporter = {
                        sendMail: (mailOptions) => {
                            console.log('📧 Email would be sent (development mode):', {
                                to: mailOptions.to,
                                subject: mailOptions.subject,
                                html: mailOptions.html ? 'HTML content available' : 'No HTML'
                            });
                            return Promise.resolve({
                                messageId: 'dev-' + Date.now(),
                                response: 'Email logged to console (development mode)'
                            });
                        }
                    };
                }
            }

            console.log('✅ Email transporter initialized');
        } catch (error) {
            console.error('❌ Error initializing email transporter:', error);
            // Fallback to console transporter
            this.transporter = {
                sendMail: (mailOptions) => {
                    console.log('📧 Email fallback (transporter error):', {
                        to: mailOptions.to,
                        subject: mailOptions.subject
                    });
                    return Promise.resolve({
                        messageId: 'fallback-' + Date.now(),
                        response: 'Email logged due to transporter error'
                    });
                }
            };
        }
    }

    async loadTemplate(templateName, context = {}) {
        try {
            const templatePath = path.join(__dirname, '../views/emails', `${templateName}.html`);
            let template = await fs.readFile(templatePath, 'utf8');
            
            // Replace template variables
            Object.keys(context).forEach(key => {
                const placeholder = `{{${key}}}`;
                template = template.replace(new RegExp(placeholder, 'g'), context[key] || '');
            });
            
            return template;
        } catch (error) {
            console.error(`❌ Error loading email template ${templateName}:`, error);
            return this.getDefaultTemplate(context);
        }
    }

    getDefaultTemplate(context) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>EduLMS</h1>
                    </div>
                    <div class="content">
                        ${context.message || 'This is a default email template.'}
                    </div>
                    <div class="footer">
                        <p>&copy; 2025 EduLMS. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    async sendEmail({ to, subject, template, context = {} }) {
        try {
            if (!this.transporter) {
                this.initializeTransporter();
            }

            const html = await this.loadTemplate(template, context);

            const mailOptions = {
                from: process.env.SMTP_FROM || 'EduLMS <noreply@edulms.com>',
                to,
                subject,
                html
            };

            const info = await this.transporter.sendMail(mailOptions);
            
            console.log('✅ Email sent successfully:', {
                to,
                subject,
                messageId: info.messageId,
                previewUrl: nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : 'Not available in development'
            });

            return info;
        } catch (error) {
            console.error('❌ Error sending email:', error);
            // Don't throw error - just log it so the application continues
            return { error: error.message };
        }
    }

    // Specific email methods
    async sendVerificationEmail(user, token) {
        const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify-email/${token}`;
        
        return this.sendEmail({
            to: user.email,
            subject: 'Verify Your Email - EduLMS',
            template: 'email-verification',
            context: {
                name: `${user.first_name} ${user.last_name}`,
                verificationUrl,
                appName: 'EduLMS',
                supportEmail: 'support@edulms.com'
            }
        });
    }

    async sendPasswordResetEmail(user, token) {
        const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
        
        return this.sendEmail({
            to: user.email,
            subject: 'Reset Your Password - EduLMS',
            template: 'password-reset',
            context: {
                name: `${user.first_name} ${user.last_name}`,
                resetUrl,
                appName: 'EduLMS',
                expiryHours: '1'
            }
        });
    }

    async sendWelcomeEmail(user) {
        return this.sendEmail({
            to: user.email,
            subject: 'Welcome to EduLMS!',
            template: 'welcome',
            context: {
                name: `${user.first_name} ${user.last_name}`,
                appName: 'EduLMS',
                loginUrl: `${process.env.APP_URL || 'http://localhost:3000'}/auth/login`,
                supportEmail: 'support@edulms.com'
            }
        });
    }
}

// Create singleton instance
const emailService = new EmailService();

// Export individual functions for backward compatibility
module.exports = {
    sendEmail: (options) => emailService.sendEmail(options),
    sendVerificationEmail: (user, token) => emailService.sendVerificationEmail(user, token),
    sendPasswordResetEmail: (user, token) => emailService.sendPasswordResetEmail(user, token),
    sendWelcomeEmail: (user) => emailService.sendWelcomeEmail(user),
    emailService
};