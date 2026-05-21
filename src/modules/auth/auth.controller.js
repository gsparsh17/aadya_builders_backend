const authService = require('./auth.service');
const userService = require('../users/user.service');
const { successResponse, errorResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const { validationResult } = require('express-validator');

/**
 * Auth Controller - Handles HTTP requests for authentication
 */
class AuthController {

  /**
   * Register new user
   * @route POST /api/v1/auth/register
   */
  async register(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.register(req.body, ipAddress, userAgent);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return successResponse(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }, 'Registration successful. Please verify your email.', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login with email and password
   * @route POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { email, password, rememberMe } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login(email, password, ipAddress, userAgent, rememberMe);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
      });

      return successResponse(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send OTP
   * @route POST /api/v1/auth/send-otp
   */
  async sendOtp(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { phone, purpose } = req.body;

      const result = await authService.sendOtp(phone, purpose);

      return successResponse(res, result, 'OTP sent successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP
   * @route POST /api/v1/auth/verify-otp
   */
  async verifyOtp(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { phone, otp, purpose } = req.body;

      await authService.verifyOtp(phone, otp, purpose);

      return successResponse(res, { verified: true }, 'OTP verified successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login with phone and OTP
   * @route POST /api/v1/auth/login/phone
   */
  async loginWithPhone(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { phone, otp } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.loginWithPhone(phone, otp, ipAddress, userAgent);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return successResponse(res, {
        user: result.user,
        accessToken: result.tokens.accessToken
      }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Social login (Google, Facebook, Apple)
   * @route POST /api/v1/auth/social-login
   */
  async socialLogin(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { provider, token, email, name } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.socialLogin(provider, token, email, name, ipAddress, userAgent);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return successResponse(res, {
        user: result.user,
        accessToken: result.tokens.accessToken
      }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Forgot password - send reset email
   * @route POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { email } = req.body;

      const result = await authService.forgotPassword(email);

      return successResponse(res, result, 'Password reset instructions sent');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password with token
   * @route POST /api/v1/auth/reset-password/:token
   */
  async resetPassword(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { token } = req.params;
      const { password } = req.body;

      const result = await authService.resetPassword(token, password);

      return successResponse(res, result, 'Password reset successful');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * @route POST /api/v1/auth/refresh-token
   */
  async refreshToken(req, res, next) {
    try {
      // Get refresh token from cookie or body
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        throw new AppError('Refresh token is required', 400, 'MISSING_TOKEN');
      }

      const tokens = await authService.refreshAccessToken(refreshToken);

      // Set new refresh token as cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return successResponse(res, {
        accessToken: tokens.accessToken
      }, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   * @route POST /api/v1/auth/logout
   */
  async logout(req, res, next) {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      const userId = req.user?.id;

      await authService.logout(accessToken, refreshToken, userId);

      // Clear cookie
      res.clearCookie('refreshToken');

      return successResponse(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email with token
   * @route GET /api/v1/auth/verify-email/:token
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.params;

      // This is handled by user service
      // For public verification, we need to find user by token
      const crypto = require('crypto');
      const User = require('../users/user.model');

      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpire: { $gt: Date.now() }
      });

      if (!user) {
        throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
      }

      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;

      if (user.phoneVerified) {
        user.isVerified = true;
      }

      await user.save();

      return successResponse(res, null, 'Email verified successfully. You can now login.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend verification email
   * @route POST /api/v1/auth/resend-verification
   */
  async resendVerification(req, res, next) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
      }

      const result = await authService.resendVerificationEmail(userId);

      return successResponse(res, result, 'Verification email sent');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password (authenticated user)
   * @route POST /api/v1/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { currentPassword, newPassword } = req.body;

      await userService.changePassword(req.user.id, currentPassword, newPassword);

      // Blacklist current tokens
      const accessToken = req.headers.authorization?.split(' ')[1];
      const refreshToken = req.cookies?.refreshToken;
      await authService.logout(accessToken, refreshToken, req.user.id);

      res.clearCookie('refreshToken');

      return successResponse(res, null, 'Password changed successfully. Please login again.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user (for token validation)
   * @route GET /api/v1/auth/me
   */
  async getCurrentUser(req, res, next) {
    try {
      const user = await userService.getUserById(req.user.id);

      return successResponse(res, { user }, 'User retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();