const express = require('express');
const router = express.Router();
const controller = require('./feedback.controller');
const { authMiddleware, optionalAuth } = require('../../middlewares/auth.middleware');

router.post('/helpful', optionalAuth, controller.helpful);
router.post('/app-rating', optionalAuth, controller.appRating);
router.post('/locality-rating', optionalAuth, controller.localityRating);
router.post('/society-rating', optionalAuth, controller.societyRating);
router.get('/my-feedback', authMiddleware, controller.myFeedback);

module.exports = router;
