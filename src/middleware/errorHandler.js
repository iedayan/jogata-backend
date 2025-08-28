const logger = require('../utils/logger');
const { sanitizeForLog } = require('../utils/sanitize');

const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('API Error:', {
    message: sanitizeForLog(err.message),
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error response
  let statusCode = err.statusCode || 500;
  let message = 'Internal server error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.code === 'P2002') { // Prisma unique constraint
    statusCode = 409;
    message = 'Resource already exists';
  } else if (err.code === 'P2025') { // Prisma record not found
    statusCode = 404;
    message = 'Resource not found';
  } else if (process.env.NODE_ENV === 'development') {
    message = err.message;
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;