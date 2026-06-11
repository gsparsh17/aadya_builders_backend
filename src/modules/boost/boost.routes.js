const express = require('express');
const router = express.Router();
const controller = require('./boost.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');

router.get('/plans', controller.getPlans);
router.use(authMiddleware);
router.post('/orders', controller.createOrder);
router.post('/verify', controller.verify);

module.exports = router;
