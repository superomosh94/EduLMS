const moment = require('moment');
const path = require('path');
const fs = require('fs');
const { ROLES, GRADE_POINTS } = require('../../config/constants');

class Helpers {
  // Format date for display
  static formatDate(date, format = 'DD/MM/YYYY') {
    if (!date) return 'N/A';
    return moment(date).format(format);
  }

  // Format date and time
  static formatDateTime(date, format = 'DD/MM/YYYY HH:mm') {
    if (!date) return 'N/A';
    return moment(date).format(format);
  }

  // Format currency (Kenyan Shillings)
  static formatCurrency(amount, currency = 'KES') {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  // Calculate age from date of birth
  static calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    return moment().diff(moment(dateOfBirth), 'years');
  }

  // Get semester from date
  static getSemesterFromDate(date = new Date()) {
    const month = moment(date).month() + 1; // 1-12
    
    if (month >= 1 && month <= 4) return 'spring';
    if (month >= 5 && month <= 8) return 'summer';
    return 'fall';
  }

  // Get academic year
  static getAcademicYear(date = new Date()) {
    const year = moment(date).year();
    const month = moment(date).month() + 1;
    
    if (month >= 9) { // September onwards
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  // Calculate grade point from grade
  static calculateGradePoint(grade) {
    return GRADE_POINTS[grade.toUpperCase()] || 0;
  }

  // Calculate GPA from grades array
  static calculateGPA(grades) {
    if (!Array.isArray(grades) || grades.length === 0) return 0;

    const totalPoints = grades.reduce((sum, grade) => {
      return sum + (this.calculateGradePoint(grade.grade) * grade.credits);
    }, 0);

    const totalCredits = grades.reduce((sum, grade) => sum + grade.credits, 0);

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  }

  // Get grade from percentage
  static getGradeFromPercentage(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 85) return 'A-';
    if (percentage >= 80) return 'B+';
    if (percentage >= 75) return 'B';
    if (percentage >= 70) return 'B-';
    if (percentage >= 65) return 'C+';
    if (percentage >= 60) return 'C';
    if (percentage >= 55) return 'C-';
    if (percentage >= 50) return 'D+';
    if (percentage >= 45) return 'D';
    return 'F';
  }

  // Truncate text
  static truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Capitalize first letter
  static capitalizeFirst(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  // Format file size
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get file extension
  static getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  // Check if file is image
  static isImageFile(filename) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.includes(this.getFileExtension(filename));
  }

  // Check if file is document
  static isDocumentFile(filename) {
    const docExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
    return docExtensions.includes(this.getFileExtension(filename));
  }

  // Generate pagination data
  static generatePagination(currentPage, totalPages, baseUrl) {
    const pages = [];
    const maxPagesToShow = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push({
        number: i,
        url: `${baseUrl}?page=${i}`,
        active: i === currentPage
      });
    }
    
    return {
      current: currentPage,
      total: totalPages,
      pages: pages,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
      prevUrl: currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : null,
      nextUrl: currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}` : null
    };
  }

  // Get user role display name
  static getRoleDisplayName(role) {
    const roleNames = {
      [ROLES.ADMIN]: 'Administrator',
      [ROLES.INSTRUCTOR]: 'Instructor',
      [ROLES.STUDENT]: 'Student',
      [ROLES.FINANCE_OFFICER]: 'Finance Officer'
    };
    
    return roleNames[role] || role;
  }

  // Get status badge class
  static getStatusBadgeClass(status) {
    const statusClasses = {
      active: 'badge-success',
      inactive: 'badge-secondary',
      pending: 'badge-warning',
      completed: 'badge-primary',
      published: 'badge-success',
      draft: 'badge-secondary',
      closed: 'badge-danger',
      submitted: 'badge-info',
      graded: 'badge-success',
      late: 'badge-warning',
      failed: 'badge-danger',
      cancelled: 'badge-secondary'
    };
    
    return statusClasses[status] || 'badge-secondary';
  }

  // Generate random color
  static generateRandomColor() {
    const colors = [
      '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
      '#1abc9c', '#34495e', '#d35400', '#c0392b', '#16a085'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Debounce function
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Deep clone object
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Merge objects
  static mergeObjects(target, source) {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeObjects(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  // Check if value is object
  static isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  // Remove null/undefined properties
  static removeEmptyProperties(obj) {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v != null)
    );
  }

  // Get days difference between dates
  static getDaysDifference(date1, date2) {
    return moment(date2).diff(moment(date1), 'days');
  }

  // Check if date is within range
  static isDateInRange(date, startDate, endDate) {
    const checkDate = moment(date);
    return checkDate.isBetween(moment(startDate), moment(endDate), null, '[]');
  }

  // Generate progress percentage
  static calculateProgress(current, total) {
    if (total === 0) return 0;
    return Math.round((current / total) * 100);
  }
}

module.exports = Helpers;