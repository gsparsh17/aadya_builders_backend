const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Plan name is required'],
    unique: true,
    trim: true
  },
  code: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  
  // Plan Type
  type: {
    type: String,
    enum: ['dealer', 'builder', 'owner', 'featured_only'],
    required: [true, 'Plan type is required']
  },
  
  // Pricing
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR'
  },
  discountPrice: {
    type: Number,
    min: [0, 'Discount price cannot be negative']
  },
  discountPercentage: Number,
  gst: {
    type: Number,
    default: 18 // 18% GST
  },
  
  // Duration
  duration: {
    type: Number, // in days
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 day']
  },
  
  // Listing Limits
  listingLimit: {
    type: Number,
    required: [true, 'Listing limit is required'],
    min: [1, 'Listing limit must be at least 1']
  },
  featuredListingLimit: {
    type: Number,
    default: 0
  },
  premiumListingLimit: {
    type: Number,
    default: 0
  },
  
  // Features
  features: [{
    name: String,
    description: String,
    included: { type: Boolean, default: true }
  }],
  
  // Benefits
  benefits: [{
    icon: String,
    title: String,
    description: String
  }],
  
  // Visibility Settings
  searchPriority: {
    type: Number,
    default: 0 // Higher number = higher priority in search
  },
  badge: {
    text: String,
    color: String,
    icon: String
  },
  
  // Additional Services
  includes: {
    bannerAds: { type: Boolean, default: false },
    projectGallery: { type: Boolean, default: false },
    dedicatedRM: { type: Boolean, default: false },
    propertyVerification: { type: Boolean, default: false },
    photoShoot: { type: Boolean, default: false },
    socialMediaPromotion: { type: Boolean, default: false },
    emailMarketing: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false },
    leadExport: { type: Boolean, default: false }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isRecommended: {
    type: Boolean,
    default: false
  },
  
  // Display
  displayOrder: {
    type: Number,
    default: 0
  },
  color: String,
  
  // Validity
  validFrom: Date,
  validTill: Date,
  
  // Terms
  termsAndConditions: String,
  cancellationPolicy: String,
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, {
  timestamps: true
});

// Pre-save hook to generate code
subscriptionPlanSchema.pre('save', function(next) {
  if (!this.code) {
    this.code = this.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  }
  
  // Calculate discount percentage
  if (this.discountPrice && this.price > 0) {
    this.discountPercentage = Math.round(((this.price - this.discountPrice) / this.price) * 100);
  }
  
  next();
});

// Virtual for display price with GST
subscriptionPlanSchema.virtual('priceWithGst').get(function() {
  return this.price + (this.price * this.gst / 100);
});

// Virtual for discount price with GST
subscriptionPlanSchema.virtual('discountPriceWithGst').get(function() {
  if (!this.discountPrice) return null;
  return this.discountPrice + (this.discountPrice * this.gst / 100);
});

// Virtual for savings amount
subscriptionPlanSchema.virtual('savings').get(function() {
  if (!this.discountPrice) return 0;
  return this.price - this.discountPrice;
});

// Indexes
subscriptionPlanSchema.index({ type: 1, isActive: 1 });
subscriptionPlanSchema.index({ code: 1 });
subscriptionPlanSchema.index({ displayOrder: 1 });

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan;