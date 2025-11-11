const validator = require('validator');
const moment = require('moment');

class Validators {
  // Email validation
  static isValidEmail(email) {
    return validator.isEmail(email) && email.length <= 255;
  }

  // Phone number validation (Kenyan format)
  static isValidPhone(phone) {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Kenyan phone numbers: 2547XXXXXXXX, 07XXXXXXXX, +2547XXXXXXXX
    const regex = /^(?:254|\+254|0)?(7(?:(?:[129][0-9])|(?:0[0-8])|(4[0-1])|(5[0-9])|(6[0-9])|(7[0-9])|(8[0-9]))[0-9]{6})$/;
    return regex.test(cleaned);
  }

  // Format phone number to E.164 format
  static formatPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('254') && cleaned.length === 12) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `+254${cleaned.substring(1)}`;
    } else if (cleaned.startsWith('7') && cleaned.length === 9) {
      return `+254${cleaned}`;
    } else if (cleaned.length === 12 && !cleaned.startsWith('254')) {
      return `+${cleaned}`;
    }
    
    return `+${cleaned}`;
  }

  // Password strength validation
  static isStrongPassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  }

  // Name validation
  static isValidName(name) {
    const regex = /^[a-zA-Z\s\-']{2,50}$/;
    return regex.test(name.trim());
  }

  // Student ID validation
  static isValidStudentId(studentId) {
    const regex = /^STU[A-Z0-9]{6,10}$/;
    return regex.test(studentId);
  }

  // Course code validation
  static isValidCourseCode(code) {
    const regex = /^[A-Z]{3,4}\d{3,4}[A-Z0-9]{0,2}$/;
    return regex.test(code);
  }

  // Amount validation
  static isValidAmount(amount) {
    return !isNaN(amount) && parseFloat(amount) > 0 && parseFloat(amount) <= 1000000;
  }

  // Date validation
  static isValidDate(dateString) {
    return moment(dateString, 'YYYY-MM-DD', true).isValid();
  }

  // Future date validation
  static isFutureDate(dateString) {
    return moment(dateString).isAfter(moment());
  }

  // Past date validation
  static isPastDate(dateString) {
    return moment(dateString).isBefore(moment());
  }

  // Date range validation
  static isValidDateRange(startDate, endDate) {
    return moment(startDate).isBefore(moment(endDate));
  }

  // File type validation
  static isValidFileType(filename, allowedTypes) {
    const extension = filename.split('.').pop().toLowerCase();
    return allowedTypes.includes(extension);
  }

  // File size validation
  static isValidFileSize(fileSize, maxSizeInMB) {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return fileSize <= maxSizeInBytes;
  }

  // URL validation
  static isValidUrl(url) {
    return validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true
    });
  }

  // Kenyan ID number validation
  static isValidKenyanId(idNumber) {
    const regex = /^\d{8}$/;
    return regex.test(idNumber);
  }

  // Grade validation
  static isValidGrade(grade) {
    const validGrades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];
    return validGrades.includes(grade.toUpperCase());
  }

  // Percentage validation
  static isValidPercentage(percentage) {
    return !isNaN(percentage) && percentage >= 0 && percentage <= 100;
  }

  // Credit hours validation
  static isValidCredits(credits) {
    return !isNaN(credits) && credits >= 0.5 && credits <= 10;
  }

  // Semester validation
  static isValidSemester(semester) {
    const validSemesters = ['spring', 'summer', 'fall', 'winter'];
    return validSemesters.includes(semester.toLowerCase());
  }

  // Academic year validation
  static isValidAcademicYear(year) {
    const regex = /^\d{4}-\d{4}$/;
    if (!regex.test(year)) return false;

    const [start, end] = year.split('-').map(Number);
    return end === start + 1;
  }

  // M-Pesa transaction code validation
  static isValidMpesaCode(code) {
    const regex = /^[A-Z0-9]{10}$/;
    return regex.test(code);
  }

  // UUID validation
  static isValidUUID(uuid) {
    return validator.isUUID(uuid);
  }

  // JSON validation
  static isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Array validation with minimum length
  static isValidArray(arr, minLength = 0) {
    return Array.isArray(arr) && arr.length >= minLength;
  }

  // Object validation
  static isValidObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
  }

  // Empty value check
  static isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  // Sanitize input
  static sanitizeInput(input) {
    if (typeof input === 'string') {
      return validator.escape(input.trim());
    }
    return input;
  }

  // Validate email domain
  static isValidEmailDomain(email, allowedDomains = []) {
    if (!this.isValidEmail(email)) return false;
    if (allowedDomains.length === 0) return true;

    const domain = email.split('@')[1];
    return allowedDomains.includes(domain);
  }
}

module.exports = Validators;