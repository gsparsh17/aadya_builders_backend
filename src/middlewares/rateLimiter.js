const rateLimit = require('express-rate-limit');

/**
 * Helper function to get client IP properly
 */
const getClientIp = (req) => {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         'unknown';
};

/**
 * Global rate limiter for all API routes
 */
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please try again later.',
    },
  },
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }
    return ip.replace(/^::ffff:/, '');
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});

/**
 * Stricter limiter for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }
    return ip.replace(/^::ffff:/, '');
  },
});

/**
 * Lead creation limiter (per user)
 */
const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'LEAD_RATE_LIMIT',
      message: 'You have reached the maximum number of contact requests per hour.',
    },
  },
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    const ip = getClientIp(req);
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }
    return ip.replace(/^::ffff:/, '');
  },
});

// ✅ Export as object with named properties
module.exports = {
  globalLimiter,
  authLimiter,
  leadLimiter,
};