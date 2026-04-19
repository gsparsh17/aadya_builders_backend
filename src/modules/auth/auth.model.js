const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['access', 'refresh'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  revokedAt: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    enum: ['logout', 'password_change', 'suspicious_activity', 'admin_action']
  }
}, {
  timestamps: true
});

// Auto-expire documents after expiry
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
tokenBlacklistSchema.index({ token: 1 });
tokenBlacklistSchema.index({ userId: 1 });

const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

// OTP Model for verification
const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true
  },
  email: String,
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['registration', 'login', 'password_reset', 'phone_verification', 'email_verification'],
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    required: true
  },
  ipAddress: String
}, {
  timestamps: true
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ phone: 1, purpose: 1 });

const OTP = mongoose.model('OTP', otpSchema);

// Login History Model
const loginHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ipAddress: String,
  userAgent: String,
  device: String,
  browser: String,
  os: String,
  location: {
    city: String,
    region: String,
    country: String,
    coordinates: {
      type: [Number],
      index: '2dsphere'
    }
  },
  loginAt: {
    type: Date,
    default: Date.now
  },
  logoutAt: Date,
  sessionDuration: Number,
  status: {
    type: String,
    enum: ['success', 'failed', 'blocked'],
    default: 'success'
  },
  failureReason: String
}, {
  timestamps: true
});

loginHistorySchema.index({ user: 1, loginAt: -1 });
loginHistorySchema.index({ ipAddress: 1 });

const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema);

module.exports = {
  TokenBlacklist,
  OTP,
  LoginHistory
};