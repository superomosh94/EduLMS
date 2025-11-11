const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    /**
     * Initialize email transporter
     */
    initializeTransporter() {
        try {
            this.transporter = nodemailer.createTransport({
                service: process.env.EMAIL_SERVICE || 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
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
            console.error('❌ Email service initialization failed:', error.message);
        }
    }

    /**
     * Simple template rendering
     */
    renderTemplate(templateName, data) {
        const templates = {
            'welcome': `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px; }
                        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                        .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Welcome to EduLMS!</h1>
                            <p>Your Educational Learning Management System</p>
                        </div>
                        <div class="content">
                            <h2>Hello ${data.name || ''},</h2>
                            <p>Welcome to EduLMS! Your account has been successfully created.</p>
                            
                            <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <p><strong>Account Details:</strong></p>
                                <p>Email: ${data.email || ''}</p>
                                <p>Role: ${data.role || ''}</p>
                            </div>

                            ${data.verificationLink ? `
                            <p>To get started, please verify your email address:</p>
                            <p style="text-align: center;">
                                <a href="${data.verificationLink}" class="button">Verify Email Address</a>
                            </p>
                            ` : ''}

                            <p>You can now log in to your account and start exploring the platform.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2024 EduLMS - Educational Learning Management System</p>
                        </div>
                    </div>
                </body>
                </html>
            `,

            'password-reset': `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px; }
                        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                        .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Password Reset Request</h1>
                            <p>EduLMS Account Security</p>
                        </div>
                        <div class="content">
                            <h2>Hello ${data.name || ''},</h2>
                            <p>We received a request to reset your password.</p>
                            
                            <p>Click the button below to set a new password:</p>
                            
                            <p style="text-align: center;">
                                <a href="${data.resetLink || '#'}" class="button">Reset Your Password</a>
                            </p>

                            <p><strong>This link will expire in 1 hour.</strong></p>
                            <p>If you didn't request this, please ignore this email.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2024 EduLMS - Educational Learning Management System</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        return templates[templateName] || `
            <!DOCTYPE html>
            <html>
            <body>
                <h2>Hello ${data.name || 'User'},</h2>
                <p>${data.message || 'This is a notification from EduLMS.'}</p>
                <p>&copy; 2024 EduLMS</p>
            </body>
            </html>
        `;
    }

    /**
     * Send welcome email to new user
     */
    async sendWelcomeEmail(user, verificationLink = null) {
        const subject = `Welcome to ${process.env.SITE_NAME || 'EduLMS'}`;
        
        const templateData = {
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
            verificationLink: verificationLink
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
        const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;

        const templateData = {
            name: `${user.firstName} ${user.lastName}`,
            resetLink: resetUrl
        };

        return this.sendEmail(
            user.email,
            subject,
            'password-reset',
            templateData
        );
    }

    /**
     * Generic email sending method
     */
    async sendEmail(to, subject, templateName, data, attachments = []) {
        try {
            if (!this.transporter) {
                console.log('📧 Email transporter not ready, skipping email send');
                return { success: false, error: 'Email transporter not initialized' };
            }

            const html = this.renderTemplate(templateName, data);

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: to,
                subject: subject,
                html: html,
                attachments: attachments
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent to ${to}: ${result.messageId}`);
            
            return {
                success: true,
                messageId: result.messageId
            };
        } catch (error) {
            console.error(`❌ Failed to send email to ${to}:`, error.message);
            
            return {
                success: false,
                error: error.message
            };
        }
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
            
            return {
                success: true,
                message: 'Email configuration is working correctly'
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