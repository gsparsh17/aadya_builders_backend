/**
 * Standard success response
 */
const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data,
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Standard paginated response
 */
const paginatedResponse = (res, data, page, limit, total, message = 'Success') => {
  const response = {
    success: true,
    message,
    data,
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
  
  return res.status(200).json(response);
};

/**
 * Standard error response
 */
const errorResponse = (res, message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) => {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };
  
  if (details) {
    response.error.details = details;
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Validation error response
 */
const validationErrorResponse = (res, errors) => {
  return errorResponse(
    res,
    'Validation failed',
    400,
    'VALIDATION_ERROR',
    errors
  );
};

module.exports = {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
};