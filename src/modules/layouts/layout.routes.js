const express = require('express');
const router = express.Router();
const layoutController = require('./layout.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');

const { uploadImages } = require('../../middlewares/upload.middleware');

// Public or semi-public routes
router.get('/project/:projectId', layoutController.getLayoutsForProject);
router.get('/:layoutId', layoutController.getLayoutDetails);

// Protected routes (User)
router.post('/plot/:plotId/lock', authMiddleware, layoutController.lockPlot);
router.post('/plot/:plotId/release', authMiddleware, layoutController.releasePlot);

// Admin / Builder route
router.post('/', authMiddleware, layoutController.createLayoutWithPlots);
router.put('/:layoutId', authMiddleware, layoutController.updateLayoutWithPlots);
router.post('/upload-image', authMiddleware, uploadImages.single('image'), layoutController.uploadLayoutImage);

module.exports = router;
