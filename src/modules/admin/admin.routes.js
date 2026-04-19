const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { isAdmin, adminRateLimit } = require('./admin.middleware');
const { body, param, query } = require('express-validator');
const { validate } = require('../../middlewares/validation.middleware');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(isAdmin);
router.use(adminRateLimit);

// ==================== Dashboard ====================

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get dashboard overview
 * @access  Private/Admin
 */
router.get(
  '/dashboard',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validate
  ],
  adminController.getDashboard
);

/**
 * @route   GET /api/v1/admin/health
 * @desc    Get system health
 * @access  Private/Admin
 */
router.get('/health', adminController.getSystemHealth);

/**
 * @route   GET /api/v1/admin/subscription-analytics
 * @desc    Get subscription analytics
 * @access  Private/Admin
 */
router.get('/subscription-analytics', adminController.getSubscriptionAnalytics);

/**
 * @route   GET /api/v1/admin/export/:type
 * @desc    Export report
 * @access  Private/Admin
 */
router.get(
  '/export/:type',
  [
    param('type').isIn(['users', 'properties', 'leads', 'transactions']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('format').optional().isIn(['json', 'csv']),
    validate
  ],
  adminController.exportReport
);

// ==================== User Management ====================

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users
 * @access  Private/Admin
 */
router.get(
  '/users',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(['buyer', 'owner', 'dealer', 'builder', 'admin']),
    query('isVerified').optional().isBoolean(),
    query('isActive').optional().isBoolean(),
    query('search').optional().isString(),
    validate
  ],
  adminController.getUsers
);

/**
 * @route   GET /api/v1/admin/users/:userId
 * @desc    Get user details
 * @access  Private/Admin
 */
router.get(
  '/users/:userId',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    validate
  ],
  adminController.getUserDetails
);

/**
 * @route   PATCH /api/v1/admin/users/:userId/status
 * @desc    Update user status
 * @access  Private/Admin
 */
router.patch(
  '/users/:userId/status',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('isActive').isBoolean().withMessage('isActive is required'),
    body('blockReason').optional().isString(),
    validate
  ],
  adminController.updateUserStatus
);

/**
 * @route   PATCH /api/v1/admin/users/:userId/role
 * @desc    Update user role
 * @access  Private/Admin
 */
router.patch(
  '/users/:userId/role',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('role').isIn(['buyer', 'owner', 'dealer', 'builder', 'admin']).withMessage('Invalid role'),
    validate
  ],
  adminController.updateUserRole
);

/**
 * @route   PATCH /api/v1/admin/users/:userId/verify
 * @desc    Verify user
 * @access  Private/Admin
 */
router.patch(
  '/users/:userId/verify',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    validate
  ],
  adminController.verifyUser
);

/**
 * @route   DELETE /api/v1/admin/users/:userId
 * @desc    Delete user
 * @access  Private/Admin
 */
router.delete(
  '/users/:userId',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    validate
  ],
  adminController.deleteUser
);

// ==================== Property Management ====================

/**
 * @route   GET /api/v1/admin/properties/pending
 * @desc    Get pending properties
 * @access  Private/Admin
 */
router.get(
  '/properties/pending',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate
  ],
  adminController.getPendingProperties
);

/**
 * @route   PATCH /api/v1/admin/properties/:propertyId/verify
 * @desc    Verify/reject property
 * @access  Private/Admin
 */
router.patch(
  '/properties/:propertyId/verify',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    body('isVerified').isBoolean().withMessage('isVerified is required'),
    body('rejectionReason').optional().isString(),
    validate
  ],
  adminController.verifyProperty
);

/**
 * @route   PATCH /api/v1/admin/properties/:propertyId/feature
 * @desc    Feature/unfeature property
 * @access  Private/Admin
 */
router.patch(
  '/properties/:propertyId/feature',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    body('isFeatured').isBoolean().withMessage('isFeatured is required'),
    body('featuredUntil').optional().isISO8601(),
    validate
  ],
  adminController.toggleFeatureProperty
);

/**
 * @route   DELETE /api/v1/admin/properties/:propertyId
 * @desc    Delete property
 * @access  Private/Admin
 */
router.delete(
  '/properties/:propertyId',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    validate
  ],
  adminController.deleteProperty
);

// ==================== Lead Management ====================

/**
 * @route   GET /api/v1/admin/leads
 * @desc    Get all leads
 * @access  Private/Admin
 */
router.get(
  '/leads',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isString(),
    query('isSpam').optional().isBoolean(),
    validate
  ],
  adminController.getLeads
);

// ==================== Plan Management ====================

/**
 * @route   GET /api/v1/admin/plans
 * @desc    Get all plans
 * @access  Private/Admin
 */
router.get('/plans', adminController.getPlans);

/**
 * @route   POST /api/v1/admin/plans
 * @desc    Create plan
 * @access  Private/Admin
 */
router.post(
  '/plans',
  [
    body('name').notEmpty().withMessage('Plan name is required'),
    body('type').isIn(['dealer', 'builder', 'owner', 'featured_only']),
    body('price').isFloat({ min: 0 }),
    body('duration').isInt({ min: 1 }),
    body('listingLimit').isInt({ min: 1 }),
    validate
  ],
  adminController.createPlan
);

/**
 * @route   PUT /api/v1/admin/plans/:planId
 * @desc    Update plan
 * @access  Private/Admin
 */
router.put(
  '/plans/:planId',
  [
    param('planId').isMongoId().withMessage('Invalid plan ID'),
    validate
  ],
  adminController.updatePlan
);

/**
 * @route   PATCH /api/v1/admin/plans/:planId/toggle
 * @desc    Toggle plan status
 * @access  Private/Admin
 */
router.patch(
  '/plans/:planId/toggle',
  [
    param('planId').isMongoId().withMessage('Invalid plan ID'),
    validate
  ],
  adminController.togglePlanStatus
);

// ==================== Settings ====================

/**
 * @route   GET /api/v1/admin/settings
 * @desc    Get system settings
 * @access  Private/Admin
 */
router.get('/settings', adminController.getSettings);

/**
 * @route   PUT /api/v1/admin/settings
 * @desc    Update system settings
 * @access  Private/Admin
 */
router.put('/settings', adminController.updateSettings);

/**
 * @route   POST /api/v1/admin/cache/clear
 * @desc    Clear cache
 * @access  Private/Admin
 */
router.post(
  '/cache/clear',
  [
    body('pattern').optional().isString(),
    validate
  ],
  adminController.clearCache
);

module.exports = router;