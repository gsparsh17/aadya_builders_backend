const { body } = require('express-validator');

const authValidation = {
  
  /**
   * Registration validation rules
   */
  register: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces'),
    
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
    
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .matches(/^[6-9]\d{9}$/).withMessage('Please provide a valid 10-digit Indian mobile number'),
    
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password must contain at least one letter and one number'),
    
    body('confirmPassword')
      .notEmpty().withMessage('Please confirm your password')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match'),
    
    body('role')
      .optional()
      .isIn(['buyer', 'owner', 'dealer', 'builder'])
      .withMessage('Invalid role selected'),
    
    body('acceptTerms')
      .notEmpty().withMessage('You must accept the terms and conditions')
      .isBoolean().withMessage('Invalid value')
      .custom(value => value === true).withMessage('You must accept the terms and conditions')
  ],

  /**
   * Login validation rules
   */
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
    
    body('password')
      .notEmpty().withMessage('Password is required'),
    
    body('rememberMe')
      .optional()
      .isBoolean().withMessage('Invalid value')
  ],

  /**
   * Login with phone validation
   */
  loginWithPhone: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .matches(/^[6-9]\d{9}$/).withMessage('Please provide a valid 10-digit Indian mobile number'),
    
    body('otp')
      .notEmpty().withMessage('OTP is required')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
      .isNumeric().withMessage('OTP must contain only numbers')
  ],

  /**
   * Forgot password validation
   */
  forgotPassword: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail()
  ],

  /**
   * Reset password validation
   */
  resetPassword: [
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password must contain at least one letter and one number'),
    
    body('confirmPassword')
      .notEmpty().withMessage('Please confirm your password')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match')
  ],

  /**
   * Send OTP validation
   */
  sendOtp: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .matches(/^[6-9]\d{9}$/).withMessage('Please provide a valid 10-digit Indian mobile number'),
    
    body('purpose')
      .notEmpty().withMessage('Purpose is required')
      .isIn(['registration', 'login', 'password_reset', 'phone_verification'])
      .withMessage('Invalid purpose')
  ],

  /**
   * Verify OTP validation
   */
  verifyOtp: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .matches(/^[6-9]\d{9}$/).withMessage('Please provide a valid 10-digit Indian mobile number'),
    
    body('otp')
      .notEmpty().withMessage('OTP is required')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
      .isNumeric().withMessage('OTP must contain only numbers'),
    
    body('purpose')
      .optional()
      .isIn(['registration', 'login', 'password_reset', 'phone_verification'])
      .withMessage('Invalid purpose')
  ],

  /**
   * Change password validation (logged in user)
   */
  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),
    
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password must contain at least one letter and one number'),
    
    body('confirmPassword')
      .notEmpty().withMessage('Please confirm your password')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Passwords do not match')
  ],

  /**
   * Refresh token validation
   */
  refreshToken: [
    body('refreshToken')
      .notEmpty().withMessage('Refresh token is required')
  ],

  /**
   * Social login validation
   */
  socialLogin: [
    body('provider')
      .notEmpty().withMessage('Provider is required')
      .isIn(['google', 'facebook', 'apple'])
      .withMessage('Invalid provider'),
    
    body('token')
      .notEmpty().withMessage('Token is required'),
    
    body('email')
      .optional()
      .isEmail().withMessage('Invalid email format'),
    
    body('name')
      .optional()
      .isString().withMessage('Invalid name format')
  ]
};

module.exports = authValidation;