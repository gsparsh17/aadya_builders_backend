const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SloUMz3umcja7V',
      key_secret: process.env.RAZORPAY_KEY_SECRET || '5d9fQJSTIQw8wCtgh94m2QBp',
    });
  }

  /**
   * Create a new order for subscription payment
   */
  async createSubscriptionOrder(amount, receiptId) {
    const options = {
      amount: Math.round(amount * 100), // Razorpay requires amount in paise
      currency: 'INR',
      receipt: receiptId,
      payment_capture: 1 // Auto capture
    };

    try {
      const order = await this.razorpay.orders.create(options);
      return order;
    } catch (error) {
      console.error('Razorpay Error:', error);
      throw new Error('Failed to create payment order');
    }
  }

  /**
   * Verify the payment signature returned by Razorpay after success
   */
  verifyPaymentSignature(orderId, paymentId, signature) {
    const secret = process.env.RAZORPAY_KEY_SECRET || '5d9fQJSTIQw8wCtgh94m2QBp';
    
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');
      
    return expectedSignature === signature;
  }
}

module.exports = new RazorpayService();