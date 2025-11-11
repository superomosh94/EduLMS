const crypto = require('crypto');
const moment = require('moment');

class Generators {
  // Generate unique student ID
  static generateStudentId() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `STU${timestamp}${random}`;
  }

  // Generate unique instructor ID
  static generateInstructorId() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `INS${timestamp}${random}`;
  }

  // Generate unique course code
  static generateCourseCode(department = 'GEN') {
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.random().toString(36).substring(2, 4).toUpperCase();
    return `${department}${timestamp}${random}`;
  }

  // Generate unique assignment code
  static generateAssignmentCode(courseCode) {
    const timestamp = Date.now().toString().slice(-4);
    return `ASG${courseCode}${timestamp}`;
  }

  // Generate payment reference
  static generatePaymentReference(prefix = 'PAY') {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  // Generate invoice number
  static generateInvoiceNumber() {
    const date = moment().format('YYYYMMDD');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `INV${date}${random}`;
  }

  // Generate receipt number
  static generateReceiptNumber() {
    const date = moment().format('YYYYMMDD');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RCP${date}${random}`;
  }

  // Generate random password
  static generatePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  // Generate verification token
  static generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate reset token
  static generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate API key
  static generateApiKey() {
    return `edulms_${crypto.randomBytes(32).toString('hex')}`;
  }

  // Generate session ID
  static generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Generate file name with timestamp
  static generateFileName(originalName, prefix = 'file') {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}.${extension}`;
  }

  // Generate bulk upload batch ID
  static generateBatchId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `BATCH${timestamp}${random}`;
  }

  // Generate report ID
  static generateReportId(type = 'RPT') {
    const date = moment().format('YYYYMMDD');
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${type}${date}${random}`;
  }

  // Generate grade ID for submissions
  static generateGradeId(studentId, assignmentId) {
    return `GRD${studentId}${assignmentId}${Date.now().toString().slice(-6)}`;
  }

  // Generate enrollment code
  static generateEnrollmentCode(courseCode, studentId) {
    const timestamp = Date.now().toString().slice(-4);
    return `ENR${courseCode}${studentId}${timestamp}`;
  }

  // Generate notification ID
  static generateNotificationId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `NOTIF${timestamp}${random}`;
  }

  // Generate audit log ID
  static generateAuditLogId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `AUDIT${timestamp}${random}`;
  }
}

module.exports = Generators;