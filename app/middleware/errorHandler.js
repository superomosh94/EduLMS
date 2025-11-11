// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', err);

  // Set default error message and status code
  let errorMessage = 'An unexpected error occurred';
  let statusCode = 500;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = err.message;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorMessage = 'Unauthorized access';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorMessage = 'Access forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorMessage = 'Resource not found';
  } else if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    errorMessage = 'Duplicate entry found';
  } else if (err.code === 'ER_NO_REFERENCED_ROW') {
    statusCode = 400;
    errorMessage = 'Referenced resource not found';
  }

  // Log error details (in production, you might want to log to a file/service)
  if (process.env.NODE_ENV === 'development') {
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      user: req.user ? req.user.id : 'anonymous'
    });
  }

  // API response
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
  }

  // Web response
  if (statusCode === 404) {
    return res.status(404).render('error/404', {
      title: 'Page Not Found',
      layout: 'layouts/layout'
    });
  }

  if (statusCode === 401 || statusCode === 403) {
    req.flash('error_msg', errorMessage);
    return res.redirect('/auth/login');
  }

  // For other errors, show error page
  res.status(statusCode).render('error/error', {
    title: 'Error',
    layout: 'layouts/layout',
    error: {
      message: errorMessage,
      status: statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler (should be last middleware)
const notFoundHandler = (req, res) => {
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  }

  res.status(404).render('error/404', {
    title: 'Page Not Found',
    layout: 'layouts/layout'
  });
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler
};