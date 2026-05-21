const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const {authMiddleware} = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const uploadMiddleware = require('../../middlewares/upload.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { body, param, query } = require('express-validator');
const { successResponse, errorResponse } = require('../../utils/responseHandler');

// All routes require authentication
router.use(authMiddleware);

// ==================== Profile Routes ====================

router.get('/profile', userController.getProfile);

router.put('/profile',
  [
    body('name').optional().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('alternatePhone').optional().matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number'),
    body('address.street').optional().isString(),
    body('address.city').optional().isString(),
    body('address.state').optional().isString(),
    body('address.pincode').optional().matches(/^\d{6}$/).withMessage('Invalid pincode'),
    validate
  ],
  userController.updateProfile
);

router.put('/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
  ],
  userController.changePassword
);

router.post('/avatar',
  uploadMiddleware.single('avatar'),
  userController.uploadAvatar
);

// ==================== Saved Properties ====================

router.get('/saved-properties',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validate
  ],
  userController.getSavedProperties
);

router.post('/saved-properties/:propertyId',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    validate
  ],
  userController.saveProperty
);

router.delete('/saved-properties/:propertyId',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    validate
  ],
  userController.removeSavedProperty
);

router.get('/saved-properties/:propertyId/check',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    validate
  ],
  userController.checkSavedStatus
);

// ==================== Recent Views ====================

router.get('/recent-views',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validate
  ],
  userController.getRecentViews
);

router.post('/recent-views/:propertyId',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    validate
  ],
  userController.trackPropertyView
);

// ==================== Preferences ====================

router.get('/preferences', userController.getPreferences);

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

router.get('/saved-searches', userController.getSavedSearches);

router.post('/saved-searches',
  [
    body('name').notEmpty().withMessage('Search name is required'),
    body('filters').isObject().withMessage('Filters must be an object'),
    validate
  ],
  userController.saveSearch
);

router.delete('/saved-searches/:searchId',
  [
    param('searchId').isMongoId().withMessage('Invalid search ID'),
    validate
  ],
  userController.deleteSavedSearch
);

// ==================== Stats & Dashboard ====================

router.get('/stats', userController.getStats);
router.get('/dashboard', userController.getDashboard);

// ==================== Verification ====================

router.post('/verify-email',
  [
    body('token').notEmpty().withMessage('Verification token is required'),
    validate
  ],
  userController.verifyEmail
);

router.post('/verify-phone',
  [
    body('otp').notEmpty().withMessage('OTP is required').isLength({ min: 6, max: 6 }),
    validate
  ],
  userController.verifyPhone
);

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

router.post('/device-token',
  [
    body('token').notEmpty().withMessage('Device token is required'),
    validate
  ],
  userController.addDeviceToken
);

router.delete('/device-token',
  [
    body('token').notEmpty().withMessage('Device token is required'),
    validate
  ],
  userController.removeDeviceToken
);

// ==================== Account Management ====================

router.post('/deactivate',
  [
    body('password').notEmpty().withMessage('Password is required'),
    body('reason').optional().isString(),
    validate
  ],
  userController.deactivateAccount
);

// ==================== PUBLIC PROFILE (MUST BE LAST BEFORE ADMIN ROUTES) ====================
// This route catches /users/:id - must be after all specific routes!

router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    validate
  ],
  userController.getUserById
);

// ==================== Admin Routes ====================

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