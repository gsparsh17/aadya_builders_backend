const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const uploadMiddleware = require('../../middlewares/upload.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { body, param, query } = require('express-validator');

// All routes require authentication
router.use(authMiddleware);

// ==================== Profile Routes ====================

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  [
    body('name').optional().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('alternatePhone').optional().matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number'),
    body('address.street').optional().isString(),
    body('address.city').optional().isString(),
    body('address.state').optional().isString(),
    body('address.pincode').optional().matches(/^\d{6}$/).withMessage('Invalid pincode'),
    body('companyDetails.companyName').optional().isString(),
    body('companyDetails.designation').optional().isString(),
    body('companyDetails.gstNumber').optional().isString(),
    validate
  ],
  userController.updateProfile
);

/**
 * @route   PUT /api/v1/users/password
 * @desc    Change password
 * @access  Private
 */
router.put('/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
  ],
  userController.changePassword
);

/**
 * @route   POST /api/v1/users/avatar
 * @desc    Upload profile picture
 * @access  Private
 */
router.post('/avatar',
  uploadMiddleware.single('avatar'),
  userController.uploadAvatar
);

// ==================== Public Profile ====================

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID (public profile)
 * @access  Public (with optional auth for additional data)
 */
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    validate
  ],
  userController.getUserById
);

// ==================== Saved Properties ====================

/**
 * @route   GET /api/v1/users/saved-properties
 * @desc    Get user's saved properties
 * @access  Private
 */
router.get('/saved-properties',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validate
  ],
  userController.getSavedProperties
);

/**
 * @route   POST /api/v1/users/saved-properties/:propertyId
 * @desc    Save property to favorites
 * @access  Private
 */
router.post('/saved-properties/:propertyId',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    validate
  ],
  userController.saveProperty
);

/**
 * @route   DELETE /api/v1/users/saved-properties/:propertyId
 * @desc    Remove property from favorites
 * @access  Private
 */
router.delete('/saved-properties/:propertyId',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    validate
  ],
  userController.removeSavedProperty
);

/**
 * @route   GET /api/v1/users/saved-properties/:propertyId/check
 * @desc    Check if property is saved
 * @access  Private
 */
router.get('/saved-properties/:propertyId/check',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    validate
  ],
  userController.checkSavedStatus
);

// ==================== Recent Views ====================

/**
 * @route   GET /api/v1/users/recent-views
 * @desc    Get user's recent property views
 * @access  Private
 */
router.get('/recent-views',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validate
  ],
  userController.getRecentViews
);

/**
 * @route   POST /api/v1/users/recent-views/:propertyId
 * @desc    Track property view
 * @access  Private
 */
router.post('/recent-views/:propertyId',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    validate
  ],
  userController.trackPropertyView
);

// ==================== Preferences ====================

/**
 * @route   GET /api/v1/users/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/preferences', userController.getPreferences);

/**
 * @route   PUT /api/v1/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences',
  [
    body('preferredLocations').optional().isArray(),
    body('propertyTypes').optional().isArray(),
    body('budgetRange.min').optional().isNumeric(),
    body('budgetRange.max').optional().isNumeric(),
    body('notificationPreferences.email').optional().isBoolean(),
    body('notificationPreferences.sms').optional().isBoolean(),
    body('notificationPreferences.push').optional().isBoolean(),
    validate
  ],
  userController.updatePreferences
);

// ==================== Saved Searches ====================

/**
 * @route   GET /api/v1/users/saved-searches
 * @desc    Get user's saved searches
 * @access  Private
 */
router.get('/saved-searches', userController.getSavedSearches);

/**
 * @route   POST /api/v1/users/saved-searches
 * @desc    Save a search
 * @access  Private
 */
router.post('/saved-searches',
  [
    body('name').notEmpty().withMessage('Search name is required'),
    body('filters').isObject().withMessage('Filters must be an object'),
    validate
  ],
  userController.saveSearch
);

/**
 * @route   DELETE /api/v1/users/saved-searches/:searchId
 * @desc    Delete a saved search
 * @access  Private
 */
router.delete('/saved-searches/:searchId',
  [
    param('searchId').isMongoId().withMessage('Invalid search ID'),
    validate
  ],
  userController.deleteSavedSearch
);

// ==================== Stats & Dashboard ====================

/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', userController.getStats);

/**
 * @route   GET /api/v1/users/dashboard
 * @desc    Get user dashboard data
 * @access  Private
 */
router.get('/dashboard', userController.getDashboard);

// ==================== Verification ====================

/**
 * @route   POST /api/v1/users/verify-email
 * @desc    Verify email with token
 * @access  Private
 */
router.post('/verify-email',
  [
    body('token').notEmpty().withMessage('Verification token is required'),
    validate
  ],
  userController.verifyEmail
);

/**
 * @route   POST /api/v1/users/verify-phone
 * @desc    Verify phone with OTP
 * @access  Private
 */
router.post('/verify-phone',
  [
    body('otp').notEmpty().withMessage('OTP is required').isLength({ min: 6, max: 6 }),
    validate
  ],
  userController.verifyPhone
);

/**
 * @route   POST /api/v1/users/verification-documents
 * @desc    Submit verification documents (for dealers/builders)
 * @access  Private
 */
router.post('/verification-documents',
  [
    body('documents').isArray().withMessage('Documents must be an array'),
    body('documents.*.type').isIn(['pan_card', 'aadhar_card', 'gst_certificate', 'rera_certificate', 'business_license']),
    body('documents.*.url').isURL().withMessage('Invalid document URL'),
    validate
  ],
  userController.submitVerificationDocuments
);

// ==================== Device Tokens ====================

/**
 * @route   POST /api/v1/users/device-token
 * @desc    Add device token for push notifications
 * @access  Private
 */
router.post('/device-token',
  [
    body('token').notEmpty().withMessage('Device token is required'),
    validate
  ],
  userController.addDeviceToken
);

/**
 * @route   DELETE /api/v1/users/device-token
 * @desc    Remove device token
 * @access  Private
 */
router.delete('/device-token',
  [
    body('token').notEmpty().withMessage('Device token is required'),
    validate
  ],
  userController.removeDeviceToken
);

// ==================== Account Management ====================

/**
 * @route   POST /api/v1/users/deactivate
 * @desc    Deactivate user account
 * @access  Private
 */
router.post('/deactivate',
  [
    body('password').notEmpty().withMessage('Password is required'),
    body('reason').optional().isString(),
    validate
  ],
  userController.deactivateAccount
);

// ==================== Admin Routes ====================

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/',
  authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(['buyer', 'owner', 'dealer', 'builder', 'admin']),
    query('isVerified').optional().isBoolean(),
    query('isActive').optional().isBoolean(),
    query('search').optional().isString(),
    validate
  ],
  async (req, res, next) => {
    try {
      const userService = require('./user.service');
      const { paginatedResponse } = require('../../utils/responseHandler');
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const result = await userService.searchUsers(req.query, page, limit);
      
      return paginatedResponse(res, result.users, page, limit, result.total, 'Users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/v1/users/:userId/status
 * @desc    Update user status (admin only)
 * @access  Private/Admin
 */
router.put('/:userId/status',
  authorize('admin'),
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('isActive').isBoolean().withMessage('isActive must be a boolean'),
    body('blockReason').optional().isString(),
    validate
  ],
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { isActive, blockReason } = req.body;
      
      const User = require('./user.model');
      const { successResponse, errorResponse } = require('../../utils/responseHandler');
      
      const user = await User.findById(userId);
      
      if (!user) {
        return errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND');
      }
      
      user.isActive = isActive;
      user.isBlocked = !isActive;
      if (blockReason) user.blockReason = blockReason;
      
      await user.save();
      
      return successResponse(res, user, `User ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/v1/users/:userId/role
 * @desc    Change user role (admin only)
 * @access  Private/Admin
 */
router.put('/:userId/role',
  authorize('admin'),
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('role').isIn(['buyer', 'owner', 'dealer', 'builder', 'admin']).withMessage('Invalid role'),
    validate
  ],
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      const User = require('./user.model');
      const { successResponse } = require('../../utils/responseHandler');
      
      const user = await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true, runValidators: true }
      );
      
      if (!user) {
        return errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND');
      }
      
      return successResponse(res, user, 'User role updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/v1/users/:userId/verify
 * @desc    Verify user (admin only)
 * @access  Private/Admin
 */
router.put('/:userId/verify',
  authorize('admin'),
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    validate
  ],
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      
      const User = require('./user.model');
      const { successResponse } = require('../../utils/responseHandler');
      
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          isVerified: true,
          emailVerified: true,
          phoneVerified: true
        },
        { new: true }
      );
      
      if (!user) {
        return errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND');
      }
      
      return successResponse(res, user, 'User verified successfully');
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;