const SubscriptionPlan = require('./subscription.model');
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
}

module.exports = new PaymentController();
