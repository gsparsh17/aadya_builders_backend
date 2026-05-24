const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { authMiddleware, authorizeRoles } = require('../../middlewares/auth.middleware');

router.use(authMiddleware);

// Admin only route for broadcasting notifications
router.post('/broadcast', authorizeRoles('admin'), notificationController.broadcastNotification);

// Admin only route for sending property recommendations
router.post('/recommendation', authorizeRoles('admin'), notificationController.sendPropertyRecommendation);

// User routes
router.get('/', notificationController.getMyNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.post('/welcome', notificationController.sendWelcomePush);

module.exports = router;
