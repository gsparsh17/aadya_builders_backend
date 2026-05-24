const express = require('express');
const router = express.Router();
const propertyController = require('./property.controller');
const propertyValidation = require('./property.validation');
const { validate } = require('../../middlewares/validation.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { optionalAuth } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { uploadImages, uploadVideos } = require('../../middlewares/upload.middleware');

// ==================== Public Routes ====================

router.get(
  '/',
  optionalAuth,
  propertyValidation.search,
  validate,
  propertyController.getProperties
);

router.get('/cities', propertyController.getCities);
router.get('/localities', propertyController.getLocalities);
router.get('/featured', propertyController.getFeaturedProperties);

router.get(
  '/price-trends',
  propertyValidation.getPriceTrends,
  validate,
  propertyController.getPriceTrends
);

router.get('/stats', propertyController.getPropertyStats);

router.get(
  '/nearby',
  propertyValidation.getNearby,
  validate,
  propertyController.getNearbyProperties
);

router.get(
  '/code/:code',
  optionalAuth,
  propertyValidation.getByCode,
  validate,
  propertyController.getPropertyByCode
);

// ==================== Parameter Routes ====================

router.get(
  '/:id',
  optionalAuth,
  propertyValidation.getById,
  validate,
  propertyController.getPropertyById
);

router.get(
  '/:id/similar',
  propertyValidation.getSimilar,
  validate,
  propertyController.getSimilarProperties
);

// ==================== Protected Routes ====================

router.use(authMiddleware);

router.post(
  '/',
  authorize('owner', 'dealer', 'builder', 'admin'),
  propertyValidation.create,
  validate,
  propertyController.createProperty
);

router.get('/my-listings', propertyController.getMyProperties);

// ==================== Admin Routes (Specific) ====================

router.get(
  '/admin/all',
  authorize('admin'),
  propertyController.adminGetAllProperties
);

// ==================== Protected Parameter Routes ====================

router.put(
  '/:id',
  propertyValidation.update,
  validate,
  propertyController.updateProperty
);

router.delete('/:id', propertyController.deleteProperty);

router.patch(
  '/:id/status',
  propertyValidation.updateStatus,
  validate,
  propertyController.updateStatus
);

router.post(
  '/:id/images',
  uploadImages.array('images', 20),
  propertyController.uploadImages
);

router.post(
  '/:id/videos',
  uploadVideos.array('videos', 5),
  propertyController.uploadVideos
);

router.delete('/:id/images/:imageId', propertyController.deleteImage);
router.delete('/:id/videos/:videoId', propertyController.deleteVideo);
router.put('/:id/images/:imageId/primary', propertyController.setPrimaryImage);
router.put('/:id/images/reorder', propertyController.reorderImages);

// ==================== Admin Parameter Routes ====================

router.put(
  '/admin/:id/verify',
  authorize('admin'),
  propertyController.adminVerifyProperty
);

router.put(
  '/admin/:id/feature',
  authorize('admin'),
  propertyController.adminToggleFeature
);

module.exports = router;