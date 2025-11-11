
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

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }));
app.use(limiter);

// Logging setup
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'storage/logs/access.log'), 
  { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));

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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
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
  next();
});

// Database connection test
const db = require('./config/database');
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed: ' + err.stack);
    process.exit(1);
  }
  console.log('✅ Connected to database as id ' + connection.threadId);
  connection.release();
});

// Routes
app.use('/', require('./app/routes/index'));

// Error handling middleware
app.use(require('./app/middleware/errorHandler'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('error/404', { 
    title: 'Page Not Found',
    layout: 'layouts/layout'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 EduLMS server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📚 Application: ${process.env.SITE_NAME || 'EduLMS'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
});

module.exports = app;