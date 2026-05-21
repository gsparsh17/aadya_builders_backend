const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authValidation = require('./auth.validation');
const { validate } = require('../../middlewares/validation.middleware');
const authMiddleware = require('./auth.middleware');
const { authLimiter } = require('../../middlewares/rateLimiter');

console.log('authLimiter:', typeof authLimiter);
console.log('validate:', typeof validate);
console.log('authMiddleware:', typeof authMiddleware);

// ==================== Public Routes ====================

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post(
  '/register',
  authLimiter,
  authValidation.register,
  validate,
  authController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login with email and password
 * @access  Public
 */
router.post(
  '/login',
  // authLimiter,
  authValidation.login,
  validate,
  authController.login
);

/**
 * @route   POST /api/v1/auth/login/phone
 * @desc    Login with phone and OTP
 * @access  Public
 */
router.post(
  '/login/phone',
  authLimiter,
  authValidation.loginWithPhone,
  validate,
  authController.loginWithPhone
);

/**
 * @route   POST /api/v1/auth/social-login
 * @desc    Social login (Google, Facebook, Apple)
 * @access  Public
 */
router.post(
  '/social-login',
  authLimiter,
  authValidation.socialLogin,
  validate,
  authController.socialLogin
);

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Send OTP to phone
 * @access  Public
 */
router.post(
  '/send-otp',
  authLimiter,
  authValidation.sendOtp,
  validate,
  authController.sendOtp
);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP
 * @access  Public
 */
router.post(
  '/verify-otp',
  authLimiter,
  authValidation.verifyOtp,
  validate,
  authController.verifyOtp
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post(
  '/forgot-password',
  authLimiter,
  authValidation.forgotPassword,
  validate,
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password/:token',
  authLimiter,
  authValidation.resetPassword,
  validate,
  authController.resetPassword
);

/**
 * @route   GET /api/v1/auth/verify-email/:token
 * @desc    Verify email with token
 * @access  Public
 */
router.get(
  '/verify-email/:token',
  authController.verifyEmail
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh-token',
  authValidation.refreshToken,
  validate,
  authController.refreshToken
);

// ==================== Protected Routes ====================

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authMiddleware,
  authController.logout
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get(
  '/me',
  authMiddleware,
  authController.getCurrentUser
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password (authenticated)
 * @access  Private
 */
router.post(
  '/change-password',
  authMiddleware,
  authValidation.changePassword,
  validate,
  authController.changePassword
);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend verification email
 * @access  Private
 */
router.post(
  '/resend-verification',
  authMiddleware,
  authController.resendVerification
);

module.exports = router;