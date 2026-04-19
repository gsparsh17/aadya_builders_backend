const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/responseHandler');

/**
 * Middleware to handle validation errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return errorResponse(
      res,
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      errors.array()
    );
  }

  next();
};

module.exports = {
  validate
};