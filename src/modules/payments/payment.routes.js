const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');

// ==================== Public Routes ====================

/**
 * @route   GET /api/v1/payments/plans
 * @desc    Get all active subscription plans
 * @access  Public
 */
router.get('/plans', paymentController.getPublicPlans);

module.exports = router;
