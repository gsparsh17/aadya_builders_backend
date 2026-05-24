const SubscriptionPlan = require('./subscription.model');
const Transaction = require('./transaction.model');
const User = require('../users/user.model');
const razorpayService = require('./razorpay.service');
const { AppError } = require('../../middlewares/errorHandler');
const { successResponse } = require('../../utils/responseHandler');

class PaymentController {
  /**
   * Get all active public subscription plans
   * @route GET /api/v1/payments/plans
   */
  async getPublicPlans(req, res, next) {
    try {
      const plans = await SubscriptionPlan.find({ isActive: true }).sort({ displayOrder: 1 });
      return successResponse(res, plans, 'Active subscription plans retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
  /**
   * Create Razorpay Order
   * @route POST /api/v1/payments/orders
   */
  async createOrder(req, res, next) {
    try {
      const { planId } = req.body;
      const userId = req.user._id;

      if (!planId) {
        return next(new AppError('Plan ID is required', 400));
      }

      const plan = await SubscriptionPlan.findById(planId);
      if (!plan || !plan.isActive) {
        return next(new AppError('Invalid or inactive subscription plan', 400));
      }

      // Calculate final amount with GST
      const amount = plan.discountPrice ? plan.discountPriceWithGst : plan.priceWithGst;

      // Create a temporary transaction
      const transaction = await Transaction.create({
        user: userId,
        plan: plan._id,
        transactionType: 'subscription',
        amount: plan.discountPrice || plan.price,
        gst: (plan.discountPrice || plan.price) * (plan.gst / 100),
        discount: plan.discountPrice ? plan.price - plan.discountPrice : 0,
        status: 'created'
      });

      // Call Razorpay API
      const order = await razorpayService.createSubscriptionOrder(amount, transaction.transactionId);

      // Update transaction with razorpay order ID
      transaction.razorpayOrderId = order.id;
      await transaction.save();

      return successResponse(res, { order, transactionId: transaction.transactionId }, 'Order created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify Razorpay Payment
   * @route POST /api/v1/payments/verify
   */
  async verifyPayment(req, res, next) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionId } = req.body;
      const userId = req.user._id;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return next(new AppError('Missing payment details', 400));
      }

      const isValid = razorpayService.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

      if (!isValid) {
        return next(new AppError('Invalid payment signature', 400));
      }

      // Find transaction
      const transaction = await Transaction.findOne({ razorpayOrderId: razorpay_order_id });
      if (!transaction) {
        return next(new AppError('Transaction not found', 404));
      }

      // Update transaction status
      transaction.status = 'captured';
      transaction.razorpayPaymentId = razorpay_payment_id;
      transaction.razorpaySignature = razorpay_signature;
      await transaction.save();

      // Find plan
      const plan = await SubscriptionPlan.findById(transaction.plan);
      
      // Update User subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + plan.duration);

      const planTypeMap = {
        'dealer': 'premium',
        'builder': 'builder_pro',
        'owner': 'premium',
        'featured_only': 'featured'
      };

      await User.findByIdAndUpdate(userId, {
        $set: {
          'subscription.plan': plan._id,
          'subscription.planName': plan.name,
          'subscription.startDate': startDate,
          'subscription.endDate': endDate,
          'subscription.listingsRemaining': plan.listingLimit,
          'subscription.isActive': true,
          'subscription.planType': planTypeMap[plan.type] || 'premium'
        }
      });

      return successResponse(res, { success: true }, 'Payment verified and subscription activated');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get User Payment History
   * @route GET /api/v1/payments/history
   */
  async getPaymentHistory(req, res, next) {
    try {
      const userId = req.user._id;

      const history = await Transaction.find({ user: userId })
        .populate('plan', 'name type features') // Populate basic plan details
        .sort({ createdAt: -1 });

      return successResponse(res, history, 'Payment history retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();
