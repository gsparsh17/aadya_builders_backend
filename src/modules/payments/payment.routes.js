const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');

// ==================== Public Routes ====================

/**
 * @route   GET /api/v1/payments/plans
 * @desc    Get all active subscription plans
 * @access  Public
 */

router.get('/plans', paymentController.getPublicPlans);

// ==================== Protected Routes ====================
router.use(authMiddleware);

/**
 * @route   POST /api/v1/payments/orders
 * @desc    Create a new Razorpay order for a subscription plan
 * @access  Private
 */
router.post('/orders', paymentController.createOrder);

/**
 * @route   POST /api/v1/payments/verify
 * @desc    Verify Razorpay payment signature
 * @access  Private
 */
router.post('/verify', paymentController.verifyPayment);

/**
 * @route   GET /api/v1/payments/history
 * @desc    Get user's payment transaction history
 * @access  Private
 */
router.get('/history', paymentController.getPaymentHistory);

module.exports = router;
