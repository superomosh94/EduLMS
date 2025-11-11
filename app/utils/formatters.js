const moment = require('moment');
const { GRADE_POINTS } = require('../../config/constants');

class Formatters {
  // Format name (First Last)
  static formatName(firstName, lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  // Format name with title
  static formatNameWithTitle(firstName, lastName, title = null) {
    const name = this.formatName(firstName, lastName);
    return title ? `${title} ${name}` : name;
  }

  // Format phone number for display
  static formatPhoneDisplay(phone) {
    if (!phone) return 'N/A';
    
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('254') && cleaned.length === 12) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `+254${cleaned.substring(1)}`;
    } else if (cleaned.length === 9) {
      return `+254${cleaned}`;
    }
    
    return phone;
  }

  // Format M-Pesa transaction date
  static formatMpesaDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    // M-Pesa timestamp format: YYYYMMDDHHmmss
    if (timestamp.length === 14) {
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(4, 6);
      const day = timestamp.substring(6, 8);
      const hour = timestamp.substring(8, 10);
      const minute = timestamp.substring(10, 12);
      const second = timestamp.substring(12, 14);
      
      return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
    }
    
    return moment(timestamp).format('DD/MM/YYYY HH:mm:ss');
  }

  // Format academic year for display
  static formatAcademicYear(year) {
    if (!year) return 'N/A';
    return year.replace('-', '/');
  }

  // Format semester for display
  static formatSemester(semester) {
    const semesterNames = {
      spring: 'Spring',
      summer: 'Summer',
      fall: 'Fall',
      winter: 'Winter'
    };
    
    return semesterNames[semester] || semester;
  }

  // Format grade with points
  static formatGradeWithPoints(grade) {
    const points = GRADE_POINTS[grade] || 0;
    return `${grade} (${points.toFixed(1)})`;
  }

  // Format GPA
  static formatGPA(gpa) {
    if (gpa === null || gpa === undefined) return 'N/A';
    return gpa.toFixed(2);
  }

  // Format percentage
  static formatPercentage(value, decimalPlaces = 1) {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(decimalPlaces)}%`;
  }

  // Format file path for display
  static formatFilePath(filePath) {
    if (!filePath) return 'N/A';
    return filePath.split('/').pop(); // Get filename only
  }

  // Format duration in weeks
  static formatDurationWeeks(weeks) {
    if (weeks === 1) return '1 week';
    return `${weeks} weeks`;
  }

  // Format credits
  static formatCredits(credits) {
    if (credits === 1) return '1 credit';
    return `${credits} credits`;
  }

  // Format enrollment status
  static formatEnrollmentStatus(status) {
    const statusNames = {
      active: 'Active',
      inactive: 'Inactive',
      completed: 'Completed',
      dropped: 'Dropped'
    };
    
    return statusNames[status] || status;
  }

  // Format payment status
  static formatPaymentStatus(status) {
    const statusNames = {
      pending: 'Pending',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled'
    };
    
    return statusNames[status] || status;
  }

  // Format assignment status
  static formatAssignmentStatus(status) {
    const statusNames = {
      draft: 'Draft',
      published: 'Published',
      closed: 'Closed'
    };
    
    return statusNames[status] || status;
  }

  // Format submission status
  static formatSubmissionStatus(status) {
    const statusNames = {
      submitted: 'Submitted',
      graded: 'Graded',
      late: 'Late Submission'
    };
    
    return statusNames[status] || status;
  }

  // Format notification type
  static formatNotificationType(type) {
    const typeNames = {
      info: 'Information',
      warning: 'Warning',
      error: 'Error',
      success: 'Success'
    };
    
    return typeNames[type] || type;
  }

  // Format file type for display
  static formatFileType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    
    const fileTypes = {
      pdf: 'PDF Document',
      doc: 'Word Document',
      docx: 'Word Document',
      txt: 'Text File',
      jpg: 'JPEG Image',
      jpeg: 'JPEG Image',
      png: 'PNG Image',
      gif: 'GIF Image',
      mp4: 'MP4 Video',
      mp3: 'MP3 Audio',
      zip: 'ZIP Archive',
      rar: 'RAR Archive'
    };
    
    return fileTypes[extension] || `${extension.toUpperCase()} File`;
  }

  // Format file size with units
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format relative time (e.g., "2 hours ago")
  static formatRelativeTime(date) {
    return moment(date).fromNow();
  }

  // Format date range
  static formatDateRange(startDate, endDate) {
    const start = moment(startDate).format('DD/MM/YYYY');
    const end = moment(endDate).format('DD/MM/YYYY');
    return `${start} - ${end}`;
  }

  // Format time remaining
  static formatTimeRemaining(endDate) {
    const now = moment();
    const end = moment(endDate);
    
    if (end.isBefore(now)) {
      return 'Expired';
    }
    
    const duration = moment.duration(end.diff(now));
    
    if (duration.days() > 0) {
      return `${duration.days()}d ${duration.hours()}h remaining`;
    } else if (duration.hours() > 0) {
      return `${duration.hours()}h ${duration.minutes()}m remaining`;
    } else {
      return `${duration.minutes()}m remaining`;
    }
  }

  // Format address
  static formatAddress(address) {
    if (!address) return 'N/A';
    return address.replace(/\n/g, ', ');
  }

  // Format JSON for display
  static formatJSON(obj) {
    return JSON.stringify(obj, null, 2);
  }

  // Format error message
  static formatErrorMessage(error) {
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return 'An unexpected error occurred';
  }

  // Format success message
  static formatSuccessMessage(message, data = null) {
    if (data) {
      return `${message}: ${data}`;
    }
    return message;
  }

  // Format student information
  static formatStudentInfo(student) {
    if (!student) return 'N/A';
    return `${student.first_name} ${student.last_name} (${student.student_id})`;
  }

  // Format instructor information
  static formatInstructorInfo(instructor) {
    if (!instructor) return 'N/A';
    return `${instructor.first_name} ${instructor.last_name} (${instructor.employee_id})`;
  }

  // Format course information
  static formatCourseInfo(course) {
    if (!course) return 'N/A';
    return `${course.code} - ${course.title}`;
  }

  // Format assignment information
  static formatAssignmentInfo(assignment) {
    if (!assignment) return 'N/A';
    return `${assignment.title} (${assignment.total_points} points)`;
  }
}

module.exports = Formatters;