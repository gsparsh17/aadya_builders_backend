const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/responseHandler');
const User = require('../modules/users/user.model');
const logger = require('../utils/logger');

/**
 * Authentication middleware - verifies JWT token
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith('Bearer')) {
      token = authHeader.split(' ')[1];
    }

    // Also check cookies for token (fallback)
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return errorResponse(res, 'Authentication required', 401, 'NO_TOKEN');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id)
      .select('-password -resetPasswordToken -resetPasswordExpire');

    if (!user) {
      return errorResponse(res, 'User not found', 401, 'USER_NOT_FOUND');
    }

    // Check if user is active
    if (!user.isActive) {
      return errorResponse(res, 'Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
    }

    // Attach user to request object
    req.user = user;
    
    // Update last active timestamp (async, don't await)
    User.updateOne(
      { _id: user._id },
      { lastActive: new Date() }
    ).catch(err => logger.error('Failed to update last active:', err));

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token', 401, 'INVALID_TOKEN');
    }
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expired', 401, 'TOKEN_EXPIRED');
    }
    logger.error('Auth middleware error:', error);
    return errorResponse(res, 'Authentication failed', 500, 'AUTH_ERROR');
  }
};

/**
 * Optional authentication - attaches user if token valid, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith('Bearer')) {
      token = authHeader.split(' ')[1];
    }

    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id)
        .select('-password -resetPasswordToken -resetPasswordExpire');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Just log, don't block the request
    logger.debug('Optional auth failed:', error.message);
  }
  
  next();
};

/**
 * Role authorization middleware
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return errorResponse(
        res, 
        `Role (${req.user?.role || 'none'}) is not allowed to access this resource`, 
        403, 
        'FORBIDDEN'
      );
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  optionalAuth,
  authorizeRoles
};