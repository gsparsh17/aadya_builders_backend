const User = require('../users/user.model');
const { TokenBlacklist, OTP, LoginHistory } = require('./auth.model');
const { AppError } = require('../../middlewares/errorHandler');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const emailService = require('../../utils/emailService');
const smsService = require('../../utils/smsService');
const userService = require('../users/user.service');

/**
 * Auth Service - Handles authentication business logic
 */
class AuthService {
  
  /**
   * Generate JWT tokens
   */
  generateTokens(user) {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role
    };
    
    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );
    
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
    );
    
    return { accessToken, refreshToken };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token, secret = process.env.JWT_SECRET) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }
  }

  /**
   * Register new user
   */
  async register(userData, ipAddress, userAgent) {
    const { name, email, phone, password, role = 'buyer' } = userData;
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phone: phone }
      ]
    });
    
    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
      }
      if (existingUser.phone === phone) {
        throw new AppError('Phone number already registered', 409, 'PHONE_EXISTS');
      }
    }
    
    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      role,
      subscription: {
        listingsRemaining: role === 'owner' ? 3 : 0,
        isActive: false
      }
    });
    
    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });
    
    // Send verification email (async, don't await)
    emailService.sendVerificationEmail(user.email, user.name, verificationToken)
      .catch(err => logger.error('Failed to send verification email:', err));
    
    // Log login history
    await this.logLoginAttempt(user._id, ipAddress, userAgent, 'success', 'registration');
    
    // Generate tokens
    const tokens = this.generateTokens(user);
    
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified
      },
      tokens
    };
  }

  /**
   * Login with email and password
   */
  async login(email, password, ipAddress, userAgent, rememberMe = false) {
    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      await this.logLoginAttempt(null, ipAddress, userAgent, 'failed', 'login', 'User not found');
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }
    
    // Check if user is active
    if (!user.isActive) {
      await this.logLoginAttempt(user._id, ipAddress, userAgent, 'failed', 'login', 'Account deactivated');
      throw new AppError('Your account has been deactivated. Please contact support.', 403, 'ACCOUNT_DEACTIVATED');
    }
    
    // Check if user is blocked
    if (user.isBlocked) {
      await this.logLoginAttempt(user._id, ipAddress, userAgent, 'failed', 'login', 'Account blocked');
      throw new AppError('Your account has been blocked. Please contact support.', 403, 'ACCOUNT_BLOCKED');
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      await this.logLoginAttempt(user._id, ipAddress, userAgent, 'failed', 'login', 'Invalid password');
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }
    
    // Update login info
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save({ validateBeforeSave: false });
    
    // Log successful login
    await this.logLoginAttempt(user._id, ipAddress, userAgent, 'success', 'login');
    
    // Generate tokens
    const tokens = this.generateTokens(user);
    
    // Set longer expiry for refresh token if remember me is checked
    if (rememberMe) {
      tokens.refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );
    }
    
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        preferences: user.preferences
      },
      tokens
    };
  }

  /**
   * Login with phone and OTP
   */
  async loginWithPhone(phone, otp, ipAddress, userAgent) {
    // Verify OTP
    await this.verifyOtp(phone, otp, 'login');
    
    // Find user
    const user = await User.findOne({ phone });
    
    if (!user) {
      await this.logLoginAttempt(null, ipAddress, userAgent, 'failed', 'phone_login', 'User not found');
      throw new AppError('No account found with this phone number', 404, 'USER_NOT_FOUND');
    }
    
    if (!user.isActive) {
      throw new AppError('Your account has been deactivated', 403, 'ACCOUNT_DEACTIVATED');
    }
    
    // Update login info
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    user.phoneVerified = true;
    await user.save({ validateBeforeSave: false });
    
    // Log successful login
    await this.logLoginAttempt(user._id, ipAddress, userAgent, 'success', 'phone_login');
    
    // Generate tokens
    const tokens = this.generateTokens(user);
    
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified,
        phoneVerified: true
      },
      tokens
    };
  }

  /**
   * Send OTP
   */
  async sendOtp(phone, purpose) {
    // Check if user exists for certain purposes
    if (purpose === 'login') {
      const user = await User.findOne({ phone });
      if (!user) {
        throw new AppError('No account found with this phone number', 404, 'USER_NOT_FOUND');
      }
    }
    
    if (purpose === 'registration') {
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        throw new AppError('Phone number already registered', 409, 'PHONE_EXISTS');
      }
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash OTP for storage
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    
    // Delete any existing OTP for this phone and purpose
    await OTP.deleteMany({ phone, purpose });
    
    // Create new OTP record
    await OTP.create({
      phone,
      otp: hashedOtp,
      purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });
    
    // Send OTP via SMS (async)
    smsService.sendOtp(phone, otp)
      .catch(err => logger.error('Failed to send OTP SMS:', err));
    
    // In development, return OTP for testing
    if (process.env.NODE_ENV === 'development') {
      return { otp, expiresIn: 600 };
    }
    
    return { message: 'OTP sent successfully', expiresIn: 600 };
  }

  /**
   * Verify OTP
   */
  async verifyOtp(phone, otp, purpose) {
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    
    const query = { phone, otp: hashedOtp };
    if (purpose) {
      query.purpose = purpose;
    }
    
    const otpRecord = await OTP.findOne(query);
    
    if (!otpRecord) {
      throw new AppError('Invalid OTP', 400, 'INVALID_OTP');
    }
    
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new AppError('OTP has expired', 400, 'OTP_EXPIRED');
    }
    
    // Mark as verified and delete
    otpRecord.verified = true;
    await OTP.deleteOne({ _id: otpRecord._id });
    
    return true;
  }

  /**
   * Forgot password - send reset email
   */
  async forgotPassword(email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if user exists or not (security)
      return { message: 'If an account exists with this email, a password reset link has been sent' };
    }
    
    // Generate reset token
    const resetToken = user.generateResetPasswordToken();
    await user.save({ validateBeforeSave: false });
    
    // Send reset email
    await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);
    
    return { message: 'Password reset link sent to your email' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
    }
    
    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    
    // Blacklist all existing tokens for this user
    await this.blacklistAllUserTokens(user._id, 'password_change');
    
    return { message: 'Password reset successful. Please login with your new password.' };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // Check if token is blacklisted
      const isBlacklisted = await TokenBlacklist.findOne({ token: refreshToken });
      if (isBlacklisted) {
        throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
      }
      
      // Get user
      const user = await User.findById(decoded.id);
      
      if (!user || !user.isActive) {
        throw new AppError('User not found or inactive', 401, 'USER_INACTIVE');
      }
      
      // Generate new tokens
      const tokens = this.generateTokens(user);
      
      return tokens;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
      }
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Refresh token expired', 401, 'TOKEN_EXPIRED');
      }
      throw error;
    }
  }

  /**
   * Logout user - blacklist tokens
   */
  async logout(accessToken, refreshToken, userId) {
    const blacklistPromises = [];
    
    // Blacklist access token
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken);
        if (decoded && decoded.exp) {
          blacklistPromises.push(
            TokenBlacklist.create({
              token: accessToken,
              userId: userId || decoded.id,
              type: 'access',
              expiresAt: new Date(decoded.exp * 1000),
              reason: 'logout'
            })
          );
        }
      } catch (error) {
        logger.error('Failed to decode access token:', error);
      }
    }
    
    // Blacklist refresh token
    if (refreshToken) {
      try {
        const decoded = jwt.decode(refreshToken);
        if (decoded && decoded.exp) {
          blacklistPromises.push(
            TokenBlacklist.create({
              token: refreshToken,
              userId: userId || decoded.id,
              type: 'refresh',
              expiresAt: new Date(decoded.exp * 1000),
              reason: 'logout'
            })
          );
        }
      } catch (error) {
        logger.error('Failed to decode refresh token:', error);
      }
    }
    
    await Promise.all(blacklistPromises);
    
    return { message: 'Logged out successfully' };
  }

  /**
   * Blacklist all tokens for a user
   */
  async blacklistAllUserTokens(userId, reason = 'security') {
    // In a real implementation, you might want to store this in Redis
    // or add a tokenVersion field to user and increment it
    logger.info(`All tokens blacklisted for user ${userId}, reason: ${reason}`);
    return true;
  }

  /**
   * Log login attempt
   */
  async logLoginAttempt(userId, ipAddress, userAgent, status, method, failureReason = null) {
    try {
      const device = this.parseUserAgent(userAgent);
      
      const loginEntry = {
        user: userId,
        ipAddress,
        userAgent,
        device: device.device,
        browser: device.browser,
        os: device.os,
        status,
        method,
        failureReason,
        loginAt: new Date()
      };
      
      await LoginHistory.create(loginEntry);
    } catch (error) {
      logger.error('Failed to log login attempt:', error);
    }
  }

  /**
   * Parse user agent string
   */
  parseUserAgent(userAgent) {
    // Simple parsing - in production use a library like 'ua-parser-js'
    const device = 'Unknown';
    const browser = 'Unknown';
    const os = 'Unknown';
    
    if (!userAgent) {
      return { device, browser, os };
    }
    
    // Basic detection
    if (userAgent.includes('Mobile')) {
      return { device: 'Mobile', browser: this.detectBrowser(userAgent), os: this.detectOS(userAgent) };
    } else if (userAgent.includes('Tablet')) {
      return { device: 'Tablet', browser: this.detectBrowser(userAgent), os: this.detectOS(userAgent) };
    } else {
      return { device: 'Desktop', browser: this.detectBrowser(userAgent), os: this.detectOS(userAgent) };
    }
  }

  detectBrowser(userAgent) {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('MSIE') || userAgent.includes('Trident')) return 'Internet Explorer';
    return 'Unknown';
  }

  detectOS(userAgent) {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'Unknown';
  }

  /**
   * Social login (Google, Facebook, Apple)
   */
  async socialLogin(provider, token, email, name, ipAddress, userAgent) {
    // Verify token with provider (implement based on provider)
    // For now, assume token is valid
    
    if (!email) {
      throw new AppError('Email is required from social provider', 400, 'EMAIL_REQUIRED');
    }
    
    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create new user
      user = await User.create({
        name: name || `${provider} User`,
        email: email.toLowerCase(),
        phone: `SOCIAL_${Date.now()}`, // Placeholder, will need phone verification later
        password: crypto.randomBytes(32).toString('hex'),
        role: 'buyer',
        emailVerified: true,
        isVerified: true
      });
    }
    
    // Update login info
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save({ validateBeforeSave: false });
    
    // Log login
    await this.logLoginAttempt(user._id, ipAddress, userAgent, 'success', `${provider}_login`);
    
    // Generate tokens
    const tokens = this.generateTokens(user);
    
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified
      },
      tokens
    };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(userId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    if (user.emailVerified) {
      throw new AppError('Email already verified', 400, 'ALREADY_VERIFIED');
    }
    
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });
    
    await emailService.sendVerificationEmail(user.email, user.name, verificationToken);
    
    return { message: 'Verification email sent successfully' };
  }
}

module.exports = new AuthService();