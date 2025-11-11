// Application constants that are used across the system

const SYSTEM_CONSTANTS = {
  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
  },

  // File upload limits
  UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_DOCUMENT_SIZE: 20 * 1024 * 1024, // 20MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_DOCUMENT_TYPES: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  },

  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: true
  },

  // Session settings
  SESSION: {
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    INACTIVITY_TIMEOUT: 60 * 60 * 1000 // 1 hour
  },

  // Token expiration times
  TOKEN_EXPIRY: {
    VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
    PASSWORD_RESET: 1 * 60 * 60 * 1000, // 1 hour
    REFRESH_TOKEN: 7 * 24 * 60 * 60 * 1000, // 7 days
    API_TOKEN: 30 * 24 * 60 * 60 * 1000 // 30 days
  },

  // Academic constants
  ACADEMIC: {
    MIN_GRADE_POINT: 0,
    MAX_GRADE_POINT: 4.0,
    PASSING_GRADE: 'D',
    MIN_PASSING_PERCENTAGE: 45,
    MAX_CREDITS_PER_SEMESTER: 24,
    MIN_ATTENDANCE_PERCENTAGE: 75
  },

  // Financial constants
  FINANCIAL: {
    MIN_PAYMENT_AMOUNT: 1,
    MAX_PAYMENT_AMOUNT: 1000000,
    LATE_FEE_PERCENTAGE: 5,
    PAYMENT_GRACE_PERIOD_DAYS: 14
  },

  // Notification settings
  NOTIFICATION: {
    MAX_RETENTION_DAYS: 90,
    BATCH_SIZE: 50,
    PUSH_INTERVAL: 5000 // 5 seconds
  },

  // Audit log retention
  AUDIT: {
    RETENTION_DAYS: 365,
    BATCH_SIZE: 1000
  },

  // Backup settings
  BACKUP: {
    RETENTION_DAYS: 30,
    MAX_BACKUP_SIZE: 1024 * 1024 * 1024, // 1GB
    SCHEDULE: '0 2 * * *' // Daily at 2 AM
  },

  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 1000,
    AUTH_MAX_REQUESTS: 5
  },

  // M-Pesa configuration
  MPESA: {
    TIMEOUT: 30 * 1000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    CALLBACK_TIMEOUT: 60 * 1000 // 60 seconds
  },

  // Email settings
  EMAIL: {
    BATCH_SIZE: 50,
    RETRY_ATTEMPTS: 3,
    TIMEOUT: 30 * 1000 // 30 seconds
  },

  // SMS settings
  SMS: {
    BATCH_SIZE: 10,
    RETRY_ATTEMPTS: 2,
    TIMEOUT: 10 * 1000 // 10 seconds
  },

  // Cache settings
  CACHE: {
    TTL: 5 * 60 * 1000, // 5 minutes
    MAX_ITEMS: 1000,
    CLEANUP_INTERVAL: 60 * 60 * 1000 // 1 hour
  },

  // Export settings
  EXPORT: {
    MAX_ROWS: 10000,
    CHUNK_SIZE: 1000,
    TIMEOUT: 5 * 60 * 1000 // 5 minutes
  }
};

// Default values for various entities
const DEFAULT_VALUES = {
  USER: {
    PROFILE_IMAGE: '/images/avatars/default-avatar.png',
    TIMEZONE: 'Africa/Nairobi',
    LANGUAGE: 'en'
  },
  COURSE: {
    THUMBNAIL: '/images/courses/default-course.jpg',
    COLOR: '#3498db',
    STATUS: 'active'
  },
  ASSIGNMENT: {
    STATUS: 'draft',
    TOTAL_POINTS: 100
  },
  PAYMENT: {
    CURRENCY: 'KES',
    STATUS: 'pending'
  },
  NOTIFICATION: {
    TYPE: 'info',
    PRIORITY: 'medium'
  }
};

// Error messages
const ERROR_MESSAGES = {
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    ACCOUNT_INACTIVE: 'Your account has been deactivated',
    UNAUTHORIZED: 'You are not authorized to access this resource',
    TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
    PASSWORD_MISMATCH: 'Passwords do not match',
    WEAK_PASSWORD: 'Password is too weak'
  },
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_PHONE: 'Please enter a valid phone number',
    INVALID_DATE: 'Please enter a valid date',
    FILE_TOO_LARGE: 'File size exceeds the maximum allowed limit',
    INVALID_FILE_TYPE: 'File type is not allowed'
  },
  DATABASE: {
    DUPLICATE_ENTRY: 'A record with this information already exists',
    FOREIGN_KEY_CONSTRAINT: 'Cannot delete this record as it is referenced by other records',
    CONNECTION_ERROR: 'Database connection error. Please try again.'
  },
  PAYMENT: {
    INSUFFICIENT_FUNDS: 'Insufficient funds to complete the transaction',
    TRANSACTION_FAILED: 'Payment transaction failed. Please try again.',
    MPESA_ERROR: 'M-Pesa service is temporarily unavailable'
  },
  SYSTEM: {
    MAINTENANCE: 'System is under maintenance. Please try again later.',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
    UNEXPECTED_ERROR: 'An unexpected error occurred. Please try again.'
  }
};

// Success messages
const SUCCESS_MESSAGES = {
  AUTH: {
    LOGIN: 'Login successful',
    LOGOUT: 'Logout successful',
    REGISTRATION: 'Registration successful',
    PASSWORD_RESET: 'Password reset successful',
    PROFILE_UPDATED: 'Profile updated successfully'
  },
  ACADEMIC: {
    COURSE_CREATED: 'Course created successfully',
    COURSE_UPDATED: 'Course updated successfully',
    ASSIGNMENT_CREATED: 'Assignment created successfully',
    ASSIGNMENT_SUBMITTED: 'Assignment submitted successfully',
    GRADE_SAVED: 'Grade saved successfully',
    ENROLLMENT_SUCCESS: 'Enrolled in course successfully'
  },
  FINANCIAL: {
    PAYMENT_SUCCESS: 'Payment completed successfully',
    INVOICE_GENERATED: 'Invoice generated successfully',
    FEE_CREATED: 'Fee structure created successfully',
    PAYMENT_VERIFIED: 'Payment verified successfully'
  },
  SYSTEM: {
    SETTINGS_UPDATED: 'Settings updated successfully',
    BACKUP_CREATED: 'Backup created successfully',
    NOTIFICATION_SENT: 'Notification sent successfully'
  }
};

module.exports = {
  SYSTEM_CONSTANTS,
  DEFAULT_VALUES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
};