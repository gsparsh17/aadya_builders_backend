const BoostPlan = require('./boostPlan.model');
const Property = require('../properties/property.model');
const Transaction = require('../payments/transaction.model');
const razorpayService = require('../payments/razorpay.service');
const { successResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');

const defaultPlans = [
  { id: 'boost_7', name: '7 Days Boost', description: 'Improve property visibility for 7 days', price: 499, durationDays: 7, multiplier: 3 },
  { id: 'boost_15', name: '15 Days Boost', description: 'Improve property visibility for 15 days', price: 899, durationDays: 15, multiplier: 3 },
  { id: 'boost_30', name: '30 Days Boost', description: 'Improve property visibility for 30 days', price: 1499, durationDays: 30, multiplier: 4 }
];

class BoostController {
  async getPlans(req, res, next) {
    try {
      const plans = await BoostPlan.find({ isActive: true }).sort({ price: 1 });
      return successResponse(res, plans.length ? plans : defaultPlans, 'Boost plans retrieved successfully');
    } catch (error) { next(error); }
  }

  async createOrder(req, res, next) {
    try {
      const { planId, propertyId } = req.body;
      const property = await Property.findOne({ _id: propertyId, owner: req.user._id });
      if (!property && req.user.role !== 'admin') throw new AppError('Property not found or access denied', 404, 'PROPERTY_NOT_FOUND');

      let plan = null;
      if (planId && !String(planId).startsWith('boost_')) plan = await BoostPlan.findById(planId);
      const selected = plan || defaultPlans.find(p => p.id === planId) || defaultPlans[0];

      const receiptId = `boost_${Date.now()}`;
      const order = await razorpayService.createSubscriptionOrder(selected.price, receiptId);
      return successResponse(res, { order, plan: selected }, 'Boost order created successfully', 201);
    } catch (error) { next(error); }
  }

  async verify(req, res, next) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, propertyId, planId } = req.body;
      const isValidSignature = razorpayService.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!isValidSignature) throw new AppError('Invalid payment signature', 400, 'INVALID_SIGNATURE');

      const selected = defaultPlans.find(p => p.id === planId) || defaultPlans[0];
      const premiumUntil = new Date(Date.now() + selected.durationDays * 24 * 60 * 60 * 1000);
      const property = await Property.findOneAndUpdate(
        { _id: propertyId, owner: req.user._id },
        { isPremium: true, isFeatured: true, premiumUntil, featuredUntil: premiumUntil, 'listingPlan.type': 'premium', 'listingPlan.purchasedAt': new Date(), 'listingPlan.expiresAt': premiumUntil },
        { new: true }
      );
      if (!property) throw new AppError('Property not found or access denied', 404, 'PROPERTY_NOT_FOUND');

      await Transaction.create({ user: req.user._id, property: property._id, amount: selected.price, currency: 'INR', transactionType: 'premium_listing', status: 'captured', razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature, metadata: { propertyId, planId, type: 'boost' } }).catch(() => null);
      return successResponse(res, property, 'Property boosted successfully');
    } catch (error) { next(error); }
  }

  async boostProperty(req, res, next) {
    try {
      const { durationDays = 7 } = req.body;
      const premiumUntil = new Date(Date.now() + Number(durationDays) * 24 * 60 * 60 * 1000);
      const property = await Property.findOneAndUpdate(
        { _id: req.params.id, owner: req.user._id },
        { isPremium: true, isFeatured: true, premiumUntil, featuredUntil: premiumUntil },
        { new: true }
      );
      if (!property && req.user.role !== 'admin') throw new AppError('Property not found or access denied', 404, 'PROPERTY_NOT_FOUND');
      return successResponse(res, property, 'Property boost applied successfully');
    } catch (error) { next(error); }
  }

  async boostStatus(req, res, next) {
    try {
      const property = await Property.findById(req.params.id).select('isPremium premiumUntil isFeatured featuredUntil listingPlan');
      if (!property) throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      return successResponse(res, {
        isBoosted: Boolean(property.isPremium && property.premiumUntil && property.premiumUntil > new Date()),
        premiumUntil: property.premiumUntil,
        isFeatured: property.isFeatured,
        featuredUntil: property.featuredUntil,
        listingPlan: property.listingPlan
      }, 'Property boost status retrieved successfully');
    } catch (error) { next(error); }
  }
}

module.exports = new BoostController();
