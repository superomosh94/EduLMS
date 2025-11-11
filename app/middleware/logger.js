const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Custom token for user ID
morgan.token('user', (req) => {
  return req.user ? req.user.id : 'anonymous';
});

// Custom token for user role
morgan.token('role', (req) => {
  return req.user ? req.user.role_name : 'guest';
});

// Custom format for access logs
const accessFormat = ':remote-addr - :user [:role] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

// Development format (colored output)
const developmentFormat = ':method :url :status :response-time ms - :res[content-length]';

// Create write stream for access logs
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, '../../storage/logs/access.log'),
  { flags: 'a' }
);

// Create write stream for error logs
const errorLogStream = fs.createWriteStream(
  path.join(__dirname, '../../storage/logs/error.log'),
  { flags: 'a' }
);

// Morgan middleware for access logging
const accessLogger = morgan(accessFormat, {
  stream: accessLogStream,
  skip: (req, res) => process.env.NODE_ENV === 'development'
});

// Morgan middleware for development
const developmentLogger = morgan(developmentFormat, {
  skip: (req, res) => process.env.NODE_ENV !== 'development'
});

// Custom logger for application events
const appLogger = {
  info: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[INFO] ${timestamp} - ${message} ${JSON.stringify(meta)}\n`;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(logEntry);
    }
    
    fs.appendFile(
      path.join(__dirname, '../../storage/logs/app.log'),
      logEntry,
      (err) => {
        if (err) console.error('Error writing to app log:', err);
      }
    );
  },

  error: (message, error = null, meta = {}) => {
    const timestamp = new Date().toISOString();
    const errorDetails = error ? ` - ${error.message}\n${error.stack}` : '';
    const logEntry = `[ERROR] ${timestamp} - ${message} ${JSON.stringify(meta)}${errorDetails}\n`;
    
    if (process.env.NODE_ENV === 'development') {
      console.error(logEntry);
    }
    
    fs.appendFile(
      path.join(__dirname, '../../storage/logs/error.log'),
      logEntry,
      (err) => {
        if (err) console.error('Error writing to error log:', err);
      }
    );
  },

  warn: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[WARN] ${timestamp} - ${message} ${JSON.stringify(meta)}\n`;
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(logEntry);
    }
    
    fs.appendFile(
      path.join(__dirname, '../../storage/logs/app.log'),
      logEntry,
      (err) => {
        if (err) console.error('Error writing to app log:', err);
      }
    );
  },

  audit: (action, user, resource, details = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[AUDIT] ${timestamp} - User ${user} performed ${action} on ${resource} - ${JSON.stringify(details)}\n`;
    
    fs.appendFile(
      path.join(__dirname, '../../storage/logs/audit.log'),
      logEntry,
      (err) => {
        if (err) console.error('Error writing to audit log:', err);
      }
    );
  }
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMeta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      user: req.user ? req.user.id : 'anonymous',
      role: req.user ? req.user.role_name : 'guest',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    if (res.statusCode >= 400) {
      appLogger.error('Request failed', null, logMeta);
    } else {
      appLogger.info('Request completed', logMeta);
    }
  });
  
  next();
};

module.exports = {
  accessLogger,
  developmentLogger,
  appLogger,
  requestLogger
};