const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // References
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan'
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property' // For featured listing purchases
  },
  
  // Transaction Details
  transactionId: {
    type: String,
    unique: true
  },
  transactionType: {
    type: String,
    enum: ['subscription', 'featured_listing', 'premium_listing', 'banner_ad', 'renewal'],
    required: true
  },
  
  // Amount Details
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR'
  },
  gst: {
    type: Number,
    default: 0
  },
  totalAmount: Number,
  discount: {
    type: Number,
    default: 0
  },
  couponCode: String,
  
  // Payment Gateway Details
  paymentGateway: {
    type: String,
    default: 'razorpay'
  },
  razorpayOrderId: {
    type: String,
    index: true
  },
  razorpayPaymentId: {
    type: String,
    index: true
  },
  razorpaySignature: String,
  
  // Payment Method
  paymentMethod: {
    type: String,
    enum: ['upi', 'card', 'netbanking', 'wallet', 'emi', 'unknown']
  },
  paymentDetails: {
    cardNetwork: String,
    cardLast4: String,
    upiId: String,
    bankName: String,
    walletName: String
  },
  
  // Status
  status: {
    type: String,
    enum: ['created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'],
    default: 'created'
  },
  failureReason: String,
  failureCode: String,
  
  // Refund Details
  refund: {
    amount: Number,
    reason: String,
    refundId: String,
    refundedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed']
    }
  },
  
  // Invoice
  invoiceNumber: {
    type: String,
    unique: true
  },
  invoiceUrl: String,
  
  // Subscription Details (if applicable)
  subscriptionDetails: {
    startDate: Date,
    endDate: Date,
    listingsRemaining: Number,
    autoRenew: { type: Boolean, default: false }
  },
  
  // Billing Information
  billingAddress: {
    name: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
    gstin: String
  },
  
  // Metadata
  metadata: mongoose.Schema.Types.Mixed,
  notes: String,
  
  // Timestamps
  completedAt: Date
  
}, {
  timestamps: true
});

// Pre-save hook to generate transaction and invoice numbers
transactionSchema.pre('save', async function(next) {
  if (!this.transactionId) {
    const timestamp = Date.now().toString().slice(-10);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.transactionId = `TXN${timestamp}${random}`;
  }
  
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const count = await mongoose.model('Transaction').countDocuments();
    this.invoiceNumber = `INV/${year}${month}/${(count + 1).toString().padStart(6, '0')}`;
  }
  
  // Calculate total amount
  this.totalAmount = this.amount + this.gst - this.discount;
  
  if (this.status === 'captured' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Indexes
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ razorpayOrderId: 1 });
transactionSchema.index({ razorpayPaymentId: 1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ invoiceNumber: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;