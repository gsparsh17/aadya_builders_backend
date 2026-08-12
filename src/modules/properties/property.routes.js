const express = require('express');
const router = express.Router();
const propertyController = require('./property.controller');
const propertyValidation = require('./property.validation');
const { validate } = require('../../middlewares/validation.middleware');
const { authMiddleware, optionalAuth } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { uploadImages, uploadVideos, uploadMedia } = require('../../middlewares/upload.middleware');
const propertyStatsController = require('./propertyStats.controller');
const shortController = require('../shorts/short.controller');
const boostController = require('../boost/boost.controller');

// ==================== Public Specific Routes ====================

router.get('/', optionalAuth, propertyValidation.search, validate, propertyController.getProperties);
router.get('/cities', propertyController.getCities);
router.get('/localities', propertyController.getLocalities);
router.get('/featured', propertyController.getFeaturedProperties);
router.get('/price-trends', propertyValidation.getPriceTrends, validate, propertyController.getPriceTrends);
router.get('/stats/types', propertyStatsController.byType);
router.get('/stats/bhk', propertyStatsController.byBhk);
router.get('/stats/posted-by', propertyStatsController.byPostedBy);
router.get('/stats', propertyController.getPropertyStats);
router.get('/nearby', propertyValidation.getNearby, validate, propertyController.getNearbyProperties);
router.get('/code/:code', optionalAuth, propertyValidation.getByCode, validate, propertyController.getPropertyByCode);

// Protected specific routes must be before /:id
router.get('/my-listings', authMiddleware, propertyController.getMyProperties);
router.get('/admin/all', authMiddleware, authorize('admin'), propertyController.adminGetAllProperties);

// ==================== Public Parameter Routes ====================

router.get('/:id/shorts', shortController.propertyShorts);
router.get('/:id/boost-status', boostController.boostStatus);
router.get('/:id/similar', propertyValidation.getSimilar, validate, propertyController.getSimilarProperties);
router.get('/:id', optionalAuth, propertyValidation.getById, validate, propertyController.getPropertyById);

// ==================== Protected Routes ====================

router.post('/upload-media', authMiddleware, uploadMedia.fields([{ name: 'images', maxCount: 20 }, { name: 'videos', maxCount: 5 }]), propertyController.uploadStandaloneMedia);
router.post('/', authMiddleware, authorize('owner', 'dealer', 'builder', 'admin', 'buyer'), propertyValidation.create, validate, propertyController.createProperty);
router.put('/:id', authMiddleware, propertyValidation.update, validate, propertyController.updateProperty);
router.post('/:id/boost', authMiddleware, boostController.boostProperty);
router.delete('/:id', authMiddleware, propertyController.deleteProperty);
router.patch('/:id/status', authMiddleware, propertyValidation.updateStatus, validate, propertyController.updateStatus);
router.post('/:id/images', authMiddleware, uploadImages.array('images', 20), propertyController.uploadImages);
router.post('/:id/videos', authMiddleware, uploadVideos.array('videos', 5), propertyController.uploadVideos);
router.delete('/:id/images/:imageId', authMiddleware, propertyController.deleteImage);
router.delete('/:id/videos/:videoId', authMiddleware, propertyController.deleteVideo);
router.put('/:id/images/:imageId/primary', authMiddleware, propertyController.setPrimaryImage);
router.put('/:id/images/reorder', authMiddleware, propertyController.reorderImages);

// ==================== Admin Parameter Routes ====================

router.put('/admin/:id/verify', authMiddleware, authorize('admin'), propertyController.adminVerifyProperty);
router.put('/admin/:id/feature', authMiddleware, authorize('admin'), propertyController.adminToggleFeature);

module.exports = router;
