module.exports = {
  // User roles
  ROLES: {
    ADMIN: 'admin',
    INSTRUCTOR: 'instructor', 
    STUDENT: 'student',
    FINANCE_OFFICER: 'finance_officer'
  },

  // Course status
  COURSE_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending',
    COMPLETED: 'completed'
  },

  // Assignment status
  ASSIGNMENT_STATUS: {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    CLOSED: 'closed'
  },

  // Submission status
  SUBMISSION_STATUS: {
    SUBMITTED: 'submitted',
    GRADED: 'graded',
    LATE: 'late'
  },

  // Payment status
  PAYMENT_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  },

  // Enrollment status
  ENROLLMENT_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    COMPLETED: 'completed',
    DROPPED: 'dropped'
  },

  // Notification types
  NOTIFICATION_TYPES: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    SUCCESS: 'success'
  },

  // Announcement types
  ANNOUNCEMENT_TYPES: {
    GENERAL: 'general',
    ACADEMIC: 'academic',
    FINANCIAL: 'financial',
    URGENT: 'urgent'
  },

  // Fee types
  FEE_TYPES: {
    TUITION: 'tuition',
    REGISTRATION: 'registration',
    LIBRARY: 'library',
    LABORATORY: 'laboratory',
    OTHER: 'other'
  },

  // Report types
  REPORT_TYPES: {
    ACADEMIC: 'academic',
    FINANCIAL: 'financial',
    ATTENDANCE: 'attendance',
    PERFORMANCE: 'performance',
    CUSTOM: 'custom'
  },

  // Academic semesters
  SEMESTERS: {
    SPRING: 'spring',
    SUMMER: 'summer',
    FALL: 'fall',
    WINTER: 'winter'
  },

  // File upload limits
  UPLOAD_LIMITS: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  },

  // Grade points mapping
  GRADE_POINTS: {
    'A': 4.0,
    'A-': 3.7,
    'B+': 3.3,
    'B': 3.0,
    'B-': 2.7,
    'C+': 2.3,
    'C': 2.0,
    'C-': 1.7,
    'D+': 1.3,
    'D': 1.0,
    'F': 0.0
  }
};