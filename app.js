require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fs = require('fs');
const MySQLStore = require('express-mysql-session')(session);

const app = express();

// Import database configuration
const db = require('./config/database');

// Session store configuration
const sessionStore = new MySQLStore({
  expiration: 86400000,
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, db);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://checkout.chapa.co"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.chapa.co", "https://checkout.chapa.co"],
      frameSrc: ["'self'", "https://checkout.chapa.co"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

app.use(limiter);
app.use('/auth', authLimiter);

// Logging setup
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'storage/logs/access.log'), 
  { flags: 'a' }
);

const errorLogStream = fs.createWriteStream(
  path.join(__dirname, 'storage/logs/error.log'), 
  { flags: 'a' }
);

app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev', {
  skip: (req, res) => res.statusCode < 400,
  stream: errorLogStream
}));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/layout');

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0'
}));

// Uploads directory static serving
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  key: 'session_cookie_name',
  secret: process.env.SESSION_SECRET || 'edu-lms-session-secret-key-2024',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Passport configuration
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.app_name = process.env.SITE_NAME || 'EduLMS';
  res.locals.currentYear = new Date().getFullYear();
  res.locals.app_version = process.env.APP_VERSION || '1.0.0';
  res.locals.app_env = process.env.NODE_ENV || 'development';
  
  // Set layout based on user role
  if (req.user) {
    switch (req.user.role) {
      case 'admin':
        res.locals.layout = 'layouts/admin-layout';
        break;
      case 'student':
        res.locals.layout = 'layouts/student-layout';
        break;
      case 'instructor':
        res.locals.layout = 'layouts/instructor-layout';
        break;
      case 'finance':
        res.locals.layout = 'layouts/finance-layout';
        break;
      default:
        res.locals.layout = 'layouts/layout';
    }
  } else {
    res.locals.layout = 'layouts/layout';
  }
  
  next();
});

// Database connection test
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed: ' + err.stack);
    process.exit(1);
  }
  console.log('✅ Connected to database as id ' + connection.threadId);
  connection.release();
});

// Import middleware with safe fallbacks
let ensureAuthenticated, requireRole, errorHandler;

try {
  const authMiddleware = require('./app/middleware/auth');
  ensureAuthenticated = authMiddleware.ensureAuthenticated || ((req, res, next) => next());
} catch (error) {
  console.error('❌ Error loading auth middleware:', error.message);
  ensureAuthenticated = (req, res, next) => next();
}

try {
  const roleMiddleware = require('./app/middleware/roleCheck');
  requireRole = roleMiddleware.requireRole || ((roles) => (req, res, next) => next());
} catch (error) {
  console.error('❌ Error loading role middleware:', error.message);
  requireRole = (roles) => (req, res, next) => next();
}

try {
  const errorMiddleware = require('./app/middleware/errorHandler');
  errorHandler = errorMiddleware.errorHandler || ((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('error/500', { title: 'Server Error' });
  });
} catch (error) {
  console.error('❌ Error loading error handler:', error.message);
  errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('error/500', { title: 'Server Error' });
  };
}

// Safe route loader function
const safeRequireRoute = (routePath, routeName) => {
  try {
    const route = require(routePath);
    if (typeof route !== 'function' && typeof route !== 'object') {
      throw new Error(`Route ${routeName} did not export a valid router`);
    }
    console.log(`✅ ${routeName} routes loaded`);
    return route;
  } catch (error) {
    console.error(`❌ ${routeName} routes failed:`, error.message);
    
    // Create a fallback router for missing routes
    const fallbackRouter = express.Router();
    fallbackRouter.get('*', (req, res) => {
      res.status(501).render('error/501', { 
        title: 'Route Not Implemented',
        message: `The ${routeName} routes are not yet implemented.`
      });
    });
    fallbackRouter.post('*', (req, res) => {
      res.status(501).json({ 
        error: 'Route not implemented',
        message: `The ${routeName} API routes are not yet implemented.`
      });
    });
    
    return fallbackRouter;
  }
};

// Routes with safe loading
console.log('🔍 Loading routes...');

// Public routes
app.use('/', safeRequireRoute('./app/routes/index', 'Index'));
app.use('/auth', safeRequireRoute('./app/routes/auth', 'Auth'));

// Protected routes with role-based access
app.use('/admin', ensureAuthenticated, requireRole(['admin']), safeRequireRoute('./app/routes/admin', 'Admin'));
app.use('/student', ensureAuthenticated, requireRole(['student']), safeRequireRoute('./app/routes/student', 'Student'));
app.use('/instructor', ensureAuthenticated, requireRole(['instructor']), safeRequireRoute('./app/routes/instructor', 'Instructor'));
app.use('/finance', ensureAuthenticated, requireRole(['finance']), safeRequireRoute('./app/routes/finance', 'Finance'));

// Academic routes
app.use('/courses', ensureAuthenticated, safeRequireRoute('./app/routes/courses', 'Courses'));
app.use('/assignments', ensureAuthenticated, safeRequireRoute('./app/routes/assignments', 'Assignments'));
app.use('/submissions', ensureAuthenticated, safeRequireRoute('./app/routes/submissions', 'Submissions'));
app.use('/grades', ensureAuthenticated, safeRequireRoute('./app/routes/grades', 'Grades'));
app.use('/enrollments', ensureAuthenticated, safeRequireRoute('./app/routes/enrollments', 'Enrollments'));

// Finance routes
app.use('/payments', ensureAuthenticated, safeRequireRoute('./app/routes/payments', 'Payments'));

// System routes
app.use('/notifications', ensureAuthenticated, safeRequireRoute('./app/routes/notifications', 'Notifications'));
app.use('/system', ensureAuthenticated, requireRole(['admin']), safeRequireRoute('./app/routes/system', 'System'));

// API routes (if needed for mobile app or external integrations)
app.use('/api/v1/auth', safeRequireRoute('./app/routes/api/auth', 'API Auth'));
app.use('/api/v1/students', ensureAuthenticated, safeRequireRoute('./app/routes/api/students', 'API Students'));
app.use('/api/v1/courses', ensureAuthenticated, safeRequireRoute('./app/routes/api/courses', 'API Courses'));

// Error handling middleware
app.use(errorHandler);

// 404 handler (must be last route)
app.use((req, res) => {
  res.status(404).render('error/404', { 
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.'
  });
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (err) => {
  console.log('❌ Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  console.log('❌ Uncaught Exception:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`
🚀 EduLMS Server Started Successfully!
----------------------------------------
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📚 Application: ${process.env.SITE_NAME || 'EduLMS'}
🔗 URL: http://localhost:${port}
📊 Version: ${process.env.APP_VERSION || '1.0.0'}
⏰ Started: ${new Date().toLocaleString()}
----------------------------------------
    `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Port ${port} is busy, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
};

// Start the server
startServer(PORT);

module.exports = app;