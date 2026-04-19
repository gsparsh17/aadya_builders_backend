const logger = require('../utils/logger');
const { errorResponse } = require('../utils/responseHandler');

class AppError extends Error {
  constructor(message, statusCode, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let error = err;

  logger?.error?.({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
  });

  if (err.name === 'CastError') {
    error = new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'INVALID_ID');
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new AppError(`Duplicate value for ${field}`, 400, 'DUPLICATE_FIELD');
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }));
    error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    error.errors = errors;
  }

  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('File too large (max 5MB)', 400, 'FILE_TOO_LARGE');
  }

  const statusCode = error.statusCode || 500;
  const errorCode = error.code || 'INTERNAL_ERROR';
  const message = error.message || 'Something went wrong';

  if (process.env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message,
        stack: err.stack,
        ...(error.errors && { details: error.errors }),
      },
    });
  }

  if (error.isOperational) {
    return errorResponse(res, message, statusCode, errorCode, error.errors);
  }

  return errorResponse(res, 'Something went wrong', 500, 'INTERNAL_ERROR');
};

module.exports = errorHandler;
module.exports.AppError = AppError;