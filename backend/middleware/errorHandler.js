const { logger } = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  if (err.name === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError') { statusCode = 401; message = 'Token expired'; }

  if (err.code === 'PGRST116') { statusCode = 404; message = 'Resource not found'; }
  if (err.code === '23505') { statusCode = 409; message = 'Duplicate entry'; }
  if (err.code === '23503') { statusCode = 400; message = 'Referenced resource does not exist'; }
  if (err.code === '23502') { statusCode = 400; message = 'Missing required field'; }

  // Redis down — degrade gracefully, don't crash
  if (err.message?.includes('ECONNREFUSED') && (err.message.includes('6379') || err.message.includes('redis'))) {
    statusCode = statusCode === 500 ? 503 : statusCode;
    message = statusCode === 503 ? 'Service temporarily unavailable' : message;
  }

  // Supabase connection pool exhausted
  if (err.message?.includes('remaining connection slots are reserved')) {
    statusCode = 503;
    message = 'Service temporarily unavailable — please try again shortly';
  }

  const logData = { message: err.message, path: req.path, method: req.method, requestId: req.requestId, statusCode, userId: req.user?.id };
  if (statusCode >= 500) {
    logger.error('Server Error', logData);
  } else {
    logger.warn('Client Error', logData);
  }

  const response = { success: false, error: message, requestId: req.requestId };
  if (process.env.NODE_ENV === 'development') {
    response.details = err.message;
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` });
};

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, notFoundHandler, asyncHandler };