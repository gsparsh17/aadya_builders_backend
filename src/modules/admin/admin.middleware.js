const { errorResponse } = require('../../utils/responseHandler');
const User = require('../users/user.model');

/**
 * Admin middleware - Check if user is admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
  }
  
  if (req.user.role !== 'admin') {
    return errorResponse(res, 'Admin access required', 403, 'ADMIN_REQUIRED');
  }
  
  next();
};

/**
 * Check if user has specific admin permission
 */
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
    }
    
    if (req.user.role !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, 'ADMIN_REQUIRED');
    }
    
    // Define admin permissions
    const adminPermissions = {
      'manage_users': true,
      'manage_properties': true,
      'manage_leads': true,
      'manage_content': true,
      'manage_payments': true,
      'view_analytics': true,
      'system_config': true
    };
    
    if (!adminPermissions[permission]) {
      return errorResponse(res, 'Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
    }
    
    next();
  };
};

/**
 * Log admin actions
 */
const logAdminAction = (action) => {
  return async (req, res, next) => {
    const logger = require('../../utils/logger');
    
    logger.info({
      message: 'Admin action',
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      action: action,
      resourceId: req.params.id,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    next();
  };
};

/**
 * Rate limit admin endpoints more strictly
 */
const adminRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many admin requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  isAdmin,
  hasPermission,
  logAdminAction,
  adminRateLimit
};