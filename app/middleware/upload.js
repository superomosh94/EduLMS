const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureUploadDirs = () => {
  const directories = [
    'public/uploads/profiles',
    'public/uploads/assignments',
    'public/uploads/submissions',
    'public/uploads/course-materials',
    'public/uploads/documents',
    'public/uploads/temp'
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureUploadDirs();

// Configure storage for profile images
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure storage for assignment files
const assignmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/assignments/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'assignment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure storage for submission files
const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/submissions/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const studentId = req.user ? req.user.id : 'anonymous';
    cb(null, `submission-${studentId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Configure storage for course materials
const courseMaterialStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/course-materials/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'material-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter function
const fileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
    }
  };
};

// Configure multer instances
const uploadProfile = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter(['image/jpeg', 'image/jpg', 'image/png', 'image/gif'])
});

const uploadAssignment = multer({
  storage: assignmentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: fileFilter([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed'
  ])
});

const uploadSubmission = multer({
  storage: submissionStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: fileFilter([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ])
});

const uploadCourseMaterial = multer({
  storage: courseMaterialStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: fileFilter([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
    'video/mp4',
    'video/mpeg',
    'audio/mpeg',
    'audio/wav'
  ])
});

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Please check the maximum file size allowed.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Please check the maximum number of files allowed.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected field. Please check the field name.'
      });
    }
  } else if (err) {
    return res.status(400).json({
      error: err.message
    });
  }
  next();
};

// Clean up temporary files middleware
const cleanupTempFiles = (req, res, next) => {
  // Clean up files older than 24 hours in temp directory
  const tempDir = 'public/uploads/temp';
  
  if (fs.existsSync(tempDir)) {
    fs.readdir(tempDir, (err, files) => {
      if (err) {
        console.error('Error reading temp directory:', err);
        return;
      }
      
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      files.forEach(file => {
        const filePath = path.join(tempDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) {
            console.error('Error stating file:', err);
            return;
          }
          
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlink(filePath, err => {
              if (err) {
                console.error('Error deleting temp file:', err);
              }
            });
          }
        });
      });
    });
  }
  
  next();
};

module.exports = {
  uploadProfile,
  uploadAssignment,
  uploadSubmission,
  uploadCourseMaterial,
  handleUploadError,
  cleanupTempFiles
};