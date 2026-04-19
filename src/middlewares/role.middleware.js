const { errorResponse } = require('../utils/responseHandler');

/**
 * Role-based authorization middleware
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
    }

    // Check if user role is in allowed roles
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'You do not have permission to perform this action', 403, 'FORBIDDEN');
    }

    next();
  };
};

/**
 * Check if user owns the resource or is admin
 */
const isResourceOwnerOrAdmin = (resourceField = 'owner') => {
  return async (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
    }

    // Admin can access anything
    if (req.user.role === 'admin') {
      return next();
    }

    const resourceId = req.params.id;
    
    if (!resourceId) {
      return errorResponse(res, 'Resource ID required', 400, 'MISSING_RESOURCE_ID');
    }

    try {
      const Model = getModelFromRequest(req);
      const resource = await Model.findById(resourceId);
      
      if (!resource) {
        return errorResponse(res, 'Resource not found', 404, 'NOT_FOUND');
      }

      const ownerId = resource[resourceField]?.toString();
      
      if (ownerId !== req.user.id) {
        return errorResponse(res, 'You do not own this resource', 403, 'FORBIDDEN');
      }

      req.resource = resource;
      next();
    } catch (error) {
      return errorResponse(res, 'Error checking ownership', 500, 'OWNERSHIP_CHECK_ERROR');
    }
  };
};

/**
 * Helper to determine model from request path
 */
const getModelFromRequest = (req) => {
  const path = req.baseUrl + req.route.path;
  
  if (path.includes('/properties')) {
    return require('../modules/properties/property.model');
  }
  if (path.includes('/leads')) {
    return require('../modules/leads/lead.model');
  }
  if (path.includes('/articles')) {
    return require('../modules/content/article.model');
  }
  
  throw new Error('Unable to determine model from request');
};

module.exports = {
  authorize,
  isResourceOwnerOrAdmin,
};