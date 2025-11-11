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

// Import middleware
const { ensureAuthenticated } = require('./app/middleware/auth');
const { requireRole } = require('./app/middleware/roleCheck');
const { errorHandler } = require('./app/middleware/errorHandler');

// Routes
app.use('/', require('./app/routes/index'));
app.use('/auth', require('./app/routes/auth'));

// Protected routes with role-based access
app.use('/admin', ensureAuthenticated, requireRole(['admin']), require('./app/routes/admin'));
app.use('/student', ensureAuthenticated, requireRole(['student']), require('./app/routes/student'));
app.use('/instructor', ensureAuthenticated, requireRole(['instructor']), require('./app/routes/instructor'));
app.use('/finance', ensureAuthenticated, requireRole(['finance']), require('./app/routes/finance'));

// Academic routes
app.use('/courses', ensureAuthenticated, require('./app/routes/courses'));
app.use('/assignments', ensureAuthenticated, require('./app/routes/assignments'));
app.use('/submissions', ensureAuthenticated, require('./app/routes/submissions'));
app.use('/grades', ensureAuthenticated, require('./app/routes/grades'));
app.use('/enrollments', ensureAuthenticated, require('./app/routes/enrollments'));

// Finance routes
app.use('/payments', ensureAuthenticated, require('./app/routes/payments'));

// System routes
app.use('/notifications', ensureAuthenticated, require('./app/routes/notifications'));
app.use('/system', ensureAuthenticated, requireRole(['admin']), require('./app/routes/system'));

// API routes (if needed for mobile app or external integrations)
app.use('/api/v1/auth', require('./app/routes/api/auth'));
app.use('/api/v1/students', ensureAuthenticated, require('./app/routes/api/students'));
app.use('/api/v1/courses', ensureAuthenticated, require('./app/routes/api/courses'));

// Error handling middleware
app.use(errorHandler);

// 404 handler (must be last route)
app.use((req, res) => {
  res.status(404).render('error/404', { 
    title: 'Page Not Found'
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