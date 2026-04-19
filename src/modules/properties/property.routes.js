const express = require('express');
const router = express.Router();
const propertyController = require('./property.controller');
const propertyValidation = require('./property.validation');
const { validate } = require('../../middlewares/validation.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { optionalAuth } = require('../../middlewares/auth.middleware');
const { authorize, isResourceOwnerOrAdmin } = require('../../middlewares/role.middleware');
const uploadMiddleware = require('../../middlewares/upload.middleware');
const { leadLimiter } = require('../../middlewares/rateLimiter');

// ==================== Public Routes ====================

/**
 * @route   GET /api/v1/properties
 * @desc    Get all properties with filters
 * @access  Public (with optional auth)
 */
router.get(
  '/',
  optionalAuth,
  propertyValidation.search,
  validate,
  propertyController.getProperties
);

/**
 * @route   GET /api/v1/properties/cities
 * @desc    Get list of cities with property count
 * @access  Public
 */
router.get('/cities', propertyController.getCities);

/**
 * @route   GET /api/v1/properties/localities
 * @desc    Get localities by city
 * @access  Public
 */
router.get(
  '/localities',
  propertyController.getLocalities
);

/**
 * @route   GET /api/v1/properties/featured
 * @desc    Get featured properties
 * @access  Public
 */
router.get('/featured', propertyController.getFeaturedProperties);

/**
 * @route   GET /api/v1/properties/price-trends
 * @desc    Get price trends for a locality
 * @access  Public
 */
router.get(
  '/price-trends',
  propertyValidation.getPriceTrends,
  validate,
  propertyController.getPriceTrends
);

/**
 * @route   GET /api/v1/properties/stats
 * @desc    Get property statistics
 * @access  Public
 */
router.get('/stats', propertyController.getPropertyStats);

/**
 * @route   GET /api/v1/properties/nearby
 * @desc    Get nearby properties by coordinates
 * @access  Public
 */
router.get(
  '/nearby',
  propertyValidation.getNearby,
  validate,
  propertyController.getNearbyProperties
);

/**
 * @route   GET /api/v1/properties/code/:code
 * @desc    Get property by property code
 * @access  Public
 */
router.get(
  '/code/:code',
  optionalAuth,
  propertyValidation.getByCode,
  validate,
  propertyController.getPropertyByCode
);

/**
 * @route   GET /api/v1/properties/:id
 * @desc    Get property by ID
 * @access  Public (with optional auth)
 */
router.get(
  '/:id',
  optionalAuth,
  propertyValidation.getById,
  validate,
  propertyController.getPropertyById
);

/**
 * @route   GET /api/v1/properties/:id/similar
 * @desc    Get similar properties
 * @access  Public
 */
router.get(
  '/:id/similar',
  propertyValidation.getSimilar,
  validate,
  propertyController.getSimilarProperties
);

// ==================== Protected Routes ====================

// All routes below require authentication
router.use(authMiddleware);

/**
 * @route   POST /api/v1/properties
 * @desc    Create new property
 * @access  Private (Owner/Dealer/Builder)
 */
router.post(
  '/',
  authorize('owner', 'dealer', 'builder', 'admin'),
  propertyValidation.create,
  validate,
  propertyController.createProperty
);

/**
 * @route   GET /api/v1/properties/my-listings
 * @desc    Get current user's properties
 * @access  Private
 */
router.get(
  '/my-listings',
  propertyController.getMyProperties
);

/**
 * @route   PUT /api/v1/properties/:id
 * @desc    Update property
 * @access  Private (Owner/Admin)
 */
router.put(
  '/:id',
  propertyValidation.update,
  validate,
  propertyController.updateProperty
);

/**
 * @route   DELETE /api/v1/properties/:id
 * @desc    Delete property
 * @access  Private (Owner/Admin)
 */
router.delete(
  '/:id',
  propertyController.deleteProperty
);

/**
 * @route   PATCH /api/v1/properties/:id/status
 * @desc    Update property status
 * @access  Private (Owner/Admin)
 */
router.patch(
  '/:id/status',
  propertyValidation.updateStatus,
  validate,
  propertyController.updateStatus
);

/**
 * @route   POST /api/v1/properties/:id/images
 * @desc    Upload property images
 * @access  Private (Owner)
 */
router.post(
  '/:id/images',
  uploadMiddleware.array('images', 20),
  propertyController.uploadImages
);

/**
 * @route   DELETE /api/v1/properties/:id/images/:imageId
 * @desc    Delete property image
 * @access  Private (Owner)
 */
router.delete(
  '/:id/images/:imageId',
  propertyController.deleteImage
);

/**
 * @route   PUT /api/v1/properties/:id/images/:imageId/primary
 * @desc    Set primary image
 * @access  Private (Owner)
 */
router.put(
  '/:id/images/:imageId/primary',
  propertyController.setPrimaryImage
);

/**
 * @route   PUT /api/v1/properties/:id/images/reorder
 * @desc    Reorder property images
 * @access  Private (Owner)
 */
router.put(
  '/:id/images/reorder',
  propertyController.reorderImages
);

// ==================== Admin Routes ====================

/**
 * @route   GET /api/v1/properties/admin/all
 * @desc    Admin: Get all properties (including pending)
 * @access  Private/Admin
 */
router.get(
  '/admin/all',
  authorize('admin'),
  propertyController.adminGetAllProperties
);

/**
 * @route   PUT /api/v1/properties/admin/:id/verify
 * @desc    Admin: Verify/reject property
 * @access  Private/Admin
 */
router.put(
  '/admin/:id/verify',
  authorize('admin'),
  propertyController.adminVerifyProperty
);

/**
 * @route   PUT /api/v1/properties/admin/:id/feature
 * @desc    Admin: Feature/unfeature property
 * @access  Private/Admin
 */
router.put(
  '/admin/:id/feature',
  authorize('admin'),
  propertyController.adminToggleFeature
);

module.exports = router;