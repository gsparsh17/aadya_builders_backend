const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  
  // Profile Information
  profilePicture: {
    type: String,
    default: null
  },
  alternatePhone: {
    type: String,
    match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number']
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, match: [/^\d{6}$/, 'Please provide a valid 6-digit pincode'] },
    country: { type: String, default: 'India' }
  },
  
  // Role and Verification
  role: {
    type: String,
    enum: ['buyer', 'owner', 'dealer', 'builder', 'admin'],
    default: 'buyer'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  verificationDocuments: [{
    type: { 
      type: String, 
      enum: ['pan_card', 'aadhar_card', 'gst_certificate', 'rera_certificate', 'business_license'] 
    },
    documentUrl: String,
    verified: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now },
    verifiedAt: Date,
    remarks: String
  }],
  
  // RERA Information (for dealers/builders)
  reraDetails: {
    reraId: { type: String, trim: true },
    reraState: { type: String },
    reraValidTill: Date
  },
  
  // Company Information (for dealers/builders)
  companyDetails: {
    companyName: { type: String, trim: true },
    designation: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    website: { type: String, trim: true },
    yearEstablished: Number,
    companyLogo: String
  },
  
  // Subscription Information
  subscription: {
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan'
    },
    startDate: Date,
    endDate: Date,
    listingsRemaining: { type: Number, default: 3 },
    listingsPosted: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
    autoRenew: { type: Boolean, default: false },
    planType: { type: String, enum: ['free', 'premium', 'featured', 'builder_basic', 'builder_pro'] }
  },
  
  // User Preferences
  preferences: {
    preferredLocations: [{
      city: String,
      locality: [String]
    }],
    propertyTypes: [{
      type: String,
      enum: ['apartment', 'villa', 'independent_house', 'builder_floor', 'plot', 'office', 'shop']
    }],
    budgetRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 }
    },
    preferredConfigurations: [{
      type: String,
      enum: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK']
    }],
    furnishingPreference: {
      type: String,
      enum: ['furnished', 'semi_furnished', 'unfurnished']
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      propertyAlerts: { type: Boolean, default: true },
      promotionalEmails: { type: Boolean, default: false }
    }
  },
  
  // Saved and Recent Items
  savedProperties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  }],
  savedSearches: [{
    name: String,
    filters: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
  }],
  recentViews: [{
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property'
    },
    viewedAt: { type: Date, default: Date.now }
  }],
  
  // Activity Tracking
  lastLogin: Date,
  lastActive: Date,
  loginCount: { type: Number, default: 0 },
  deviceTokens: [String], // For push notifications
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: String,
  
  // Password Reset
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  // Email Verification
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  
  // Phone Verification
  phoneOtp: String,
  phoneOtpExpire: Date
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full address
userSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';
  const { street, city, state, pincode } = this.address;
  return [street, city, state, pincode].filter(Boolean).join(', ');
});

// Virtual for total properties listed
userSchema.virtual('totalProperties', {
  ref: 'Property',
  localField: '_id',
  foreignField: 'owner',
  count: true
});

// Virtual for active properties
userSchema.virtual('activeProperties', {
  ref: 'Property',
  localField: '_id',
  foreignField: 'owner',
  count: true,
  match: { status: 'active' }
});

// Virtual for total leads received
userSchema.virtual('totalLeads', {
  ref: 'Lead',
  localField: '_id',
  foreignField: 'owner',
  count: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate reset password token
userSchema.methods.generateResetPasswordToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
  
  return resetToken;
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

// Generate phone OTP
userSchema.methods.generatePhoneOtp = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  this.phoneOtp = crypto
    .createHash('sha256')
    .update(otp)
    .digest('hex');
  
  this.phoneOtpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return otp;
};

// Check if subscription is active
userSchema.methods.hasActiveSubscription = function() {
  return this.subscription?.isActive && 
         this.subscription?.endDate > new Date() &&
         this.subscription?.listingsRemaining > 0;
};

// Check if user can post property
userSchema.methods.canPostProperty = function() {
  if (this.role === 'admin') return true;
  
  if (this.role === 'owner') {
    // Free tier: max 3 active listings
    return this.subscription?.listingsRemaining > 0 || 
           (this.subscription?.listingsPosted || 0) < 3;
  }
  
  // Dealers and builders need active subscription
  return this.hasActiveSubscription();
};

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'subscription.isActive': 1 });
userSchema.index({ isActive: 1, isBlocked: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'preferences.preferredLocations.city': 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;