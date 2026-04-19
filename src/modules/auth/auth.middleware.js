const jwt = require('jsonwebtoken');
const { TokenBlacklist } = require('./auth.model');
const User = require('../users/user.model');
const { errorResponse } = require('../../utils/responseHandler');
const logger = require('../../utils/logger');

/**
 * Authentication middleware - Verifies JWT token and attaches user to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    let token;
    
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // Also check cookies for token
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    
    if (!token) {
      return errorResponse(res, 'Authentication required. Please login.', 401, 'NO_TOKEN');
    }
    
    // Check if token is blacklisted
    const isBlacklisted = await TokenBlacklist.findOne({ token });
    if (isBlacklisted) {
      return errorResponse(res, 'Token has been revoked. Please login again.', 401, 'TOKEN_REVOKED');
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id)
      .select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken -phoneOtp');
    
    if (!user) {
      return errorResponse(res, 'User not found', 401, 'USER_NOT_FOUND');
    }
    
    // Check if user is active
    if (!user.isActive) {
      return errorResponse(res, 'Your account has been deactivated. Please contact support.', 403, 'ACCOUNT_DEACTIVATED');
    }
    
    // Check if user is blocked
    if (user.isBlocked) {
      return errorResponse(res, 'Your account has been blocked. Please contact support.', 403, 'ACCOUNT_BLOCKED');
    }
    
    // Attach user to request
    req.user = user;
    req.userId = user._id;
    
    // Update last active timestamp (async, don't wait)
    User.updateOne(
      { _id: user._id },
      { lastActive: new Date() }
    ).catch(err => logger.error('Failed to update last active:', err));
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token. Please login again.', 401, 'INVALID_TOKEN');
    }
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expired. Please login again.', 401, 'TOKEN_EXPIRED');
    }
    logger.error('Auth middleware error:', error);
    return errorResponse(res, 'Authentication failed', 500, 'AUTH_ERROR');
  }
};

/**
 * Optional authentication - Attaches user if token is valid, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    
    if (token) {
      const isBlacklisted = await TokenBlacklist.findOne({ token });
      if (!isBlacklisted) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id)
          .select('-password -resetPasswordToken -resetPasswordExpire');
        
        if (user && user.isActive && !user.isBlocked) {
          req.user = user;
          req.userId = user._id;
        }
      }
    }
  } catch (error) {
    // Silently fail - user remains unauthenticated
    logger.debug('Optional auth failed:', error.message);
  }
  
  next();
};

/**
 * Strict authentication - Requires email verification
 */
const requireVerified = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
    }
    
    if (!req.user.emailVerified && !req.user.phoneVerified) {
      return errorResponse(res, 'Please verify your email or phone number to access this feature', 403, 'VERIFICATION_REQUIRED');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has specific role
 */
const hasRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
    }
    
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'You do not have permission to access this resource', 403, 'FORBIDDEN');
    }
    
    next();
  };
};

/**
 * Check if user is admin
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
 * Check if user is owner of the resource or admin
 */
const isOwnerOrAdmin = (resourceModel, resourceIdParam = 'id', ownerField = 'owner') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return errorResponse(res, 'Authentication required', 401, 'AUTH_REQUIRED');
      }
      
      // Admin can access anything
      if (req.user.role === 'admin') {
        return next();
      }
      
      const resourceId = req.params[resourceIdParam];
      
      if (!resourceId) {
        return errorResponse(res, 'Resource ID is required', 400, 'MISSING_RESOURCE_ID');
      }
      
      const resource = await resourceModel.findById(resourceId);
      
      if (!resource) {
        return errorResponse(res, 'Resource not found', 404, 'NOT_FOUND');
      }
      
      const ownerId = resource[ownerField]?.toString();
      
      if (ownerId !== req.user.id) {
        return errorResponse(res, 'You do not own this resource', 403, 'FORBIDDEN');
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;
module.exports.requireVerified = requireVerified;
module.exports.hasRole = hasRole;
module.exports.isAdmin = isAdmin;
module.exports.isOwnerOrAdmin = isOwnerOrAdmin;