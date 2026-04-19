const userService = require('./user.service');
const { successResponse, paginatedResponse, errorResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const { validationResult } = require('express-validator');

/**
 * User Controller - Handles HTTP requests for user operations
 */
class UserController {
  
  /**
   * Get current user profile
   * @route GET /api/v1/users/profile
   */
  async getProfile(req, res, next) {
    try {
      const user = await userService.getUserById(req.user.id, ['subscription.plan']);
      
      // Get additional stats
      const stats = await userService.getUserStats(req.user.id);
      
      return successResponse(res, {
        user,
        stats
      }, 'Profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID (public profile)
   * @route GET /api/v1/users/:id
   */
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      
      // Only return public information
      const user = await userService.getUserById(id);
      
      const publicProfile = {
        id: user._id,
        name: user.name,
        profilePicture: user.profilePicture,
        role: user.role,
        isVerified: user.isVerified,
        memberSince: user.createdAt,
        companyDetails: user.role === 'dealer' || user.role === 'builder' ? {
          companyName: user.companyDetails?.companyName,
          companyLogo: user.companyDetails?.companyLogo,
          yearEstablished: user.companyDetails?.yearEstablished,
          reraId: user.reraDetails?.reraId
        } : null
      };
      
      return successResponse(res, publicProfile, 'User profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   * @route PUT /api/v1/users/profile
   */
  async updateProfile(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const updatedUser = await userService.updateProfile(req.user.id, req.body);
      
      return successResponse(res, updatedUser, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   * @route PUT /api/v1/users/password
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        throw new AppError('Current password and new password are required', 400, 'MISSING_FIELDS');
      }
      
      if (newPassword.length < 6) {
        throw new AppError('Password must be at least 6 characters', 400, 'INVALID_PASSWORD');
      }
      
      await userService.changePassword(req.user.id, currentPassword, newPassword);
      
      return successResponse(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload profile picture
   * @route POST /api/v1/users/avatar
   */
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        throw new AppError('Please upload an image file', 400, 'NO_FILE');
      }
      
      const user = await userService.updateProfilePicture(req.user.id, req.file.location || req.file.path);
      
      return successResponse(res, {
        profilePicture: user.profilePicture
      }, 'Profile picture updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get saved properties
   * @route GET /api/v1/users/saved-properties
   */
  async getSavedProperties(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const result = await userService.getSavedProperties(req.user.id, page, limit);
      
      return paginatedResponse(res, result.properties, page, limit, result.total, 'Saved properties retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Save property to favorites
   * @route POST /api/v1/users/saved-properties/:propertyId
   */
  async saveProperty(req, res, next) {
    try {
      const { propertyId } = req.params;
      
      const savedProperties = await userService.saveProperty(req.user.id, propertyId);
      
      return successResponse(res, {
        savedProperties,
        isSaved: true
      }, 'Property saved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove property from favorites
   * @route DELETE /api/v1/users/saved-properties/:propertyId
   */
  async removeSavedProperty(req, res, next) {
    try {
      const { propertyId } = req.params;
      
      const savedProperties = await userService.removeSavedProperty(req.user.id, propertyId);
      
      return successResponse(res, {
        savedProperties,
        isSaved: false
      }, 'Property removed from saved list');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if property is saved
   * @route GET /api/v1/users/saved-properties/:propertyId/check
   */
  async checkSavedStatus(req, res, next) {
    try {
      const { propertyId } = req.params;
      const user = await userService.getUserById(req.user.id);
      
      const isSaved = user.savedProperties.some(
        id => id.toString() === propertyId
      );
      
      return successResponse(res, { isSaved }, 'Check completed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent views
   * @route GET /api/v1/users/recent-views
   */
  async getRecentViews(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const result = await userService.getRecentViews(req.user.id, page, limit);
      
      return paginatedResponse(res, result.views, page, limit, result.total, 'Recent views retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Track property view (called when user views a property)
   * @route POST /api/v1/users/recent-views/:propertyId
   */
  async trackPropertyView(req, res, next) {
    try {
      const { propertyId } = req.params;
      
      const recentViews = await userService.trackPropertyView(req.user.id, propertyId);
      
      return successResponse(res, { count: recentViews.length }, 'View tracked');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user preferences
   * @route GET /api/v1/users/preferences
   */
  async getPreferences(req, res, next) {
    try {
      const user = await userService.getUserById(req.user.id);
      
      return successResponse(res, user.preferences || {}, 'Preferences retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user preferences
   * @route PUT /api/v1/users/preferences
   */
  async updatePreferences(req, res, next) {
    try {
      const preferences = await userService.updatePreferences(req.user.id, req.body);
      
      return successResponse(res, preferences, 'Preferences updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get saved searches
   * @route GET /api/v1/users/saved-searches
   */
  async getSavedSearches(req, res, next) {
    try {
      const searches = await userService.getSavedSearches(req.user.id);
      
      return successResponse(res, searches, 'Saved searches retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Save search
   * @route POST /api/v1/users/saved-searches
   */
  async saveSearch(req, res, next) {
    try {
      const { name, filters } = req.body;
      
      if (!name || !filters) {
        throw new AppError('Name and filters are required', 400, 'MISSING_FIELDS');
      }
      
      const searches = await userService.saveSearch(req.user.id, name, filters);
      
      return successResponse(res, searches, 'Search saved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete saved search
   * @route DELETE /api/v1/users/saved-searches/:searchId
   */
  async deleteSavedSearch(req, res, next) {
    try {
      const { searchId } = req.params;
      
      const searches = await userService.deleteSavedSearch(req.user.id, searchId);
      
      return successResponse(res, searches, 'Search deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user statistics
   * @route GET /api/v1/users/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await userService.getUserStats(req.user.id);
      
      return successResponse(res, stats, 'Statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user dashboard data
   * @route GET /api/v1/users/dashboard
   */
  async getDashboard(req, res, next) {
    try {
      const userId = req.user.id;
      
      const Property = require('../properties/property.model');
      const Lead = require('../leads/lead.model');
      
      const [stats, recentProperties, recentLeads] = await Promise.all([
        userService.getUserStats(userId),
        Property.find({ owner: userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('title price purpose status views leads createdAt primaryImage'),
        Lead.find({ 
          $or: [
            { owner: userId },
            { buyer: userId }
          ]
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('property', 'title primaryImage')
          .populate('buyer', 'name')
      ]);
      
      return successResponse(res, {
        stats,
        recentProperties,
        recentLeads
      }, 'Dashboard data retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email
   * @route POST /api/v1/users/verify-email
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;
      
      if (!token) {
        throw new AppError('Verification token is required', 400, 'MISSING_TOKEN');
      }
      
      await userService.verifyEmail(req.user.id, token);
      
      return successResponse(res, null, 'Email verified successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify phone
   * @route POST /api/v1/users/verify-phone
   */
  async verifyPhone(req, res, next) {
    try {
      const { otp } = req.body;
      
      if (!otp) {
        throw new AppError('OTP is required', 400, 'MISSING_OTP');
      }
      
      await userService.verifyPhone(req.user.id, otp);
      
      return successResponse(res, null, 'Phone verified successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit verification documents
   * @route POST /api/v1/users/verification-documents
   */
  async submitVerificationDocuments(req, res, next) {
    try {
      const { documents } = req.body;
      
      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        throw new AppError('Documents are required', 400, 'MISSING_DOCUMENTS');
      }
      
      const result = await userService.submitVerificationDocuments(req.user.id, documents);
      
      return successResponse(res, result, 'Documents submitted for verification');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add device token for push notifications
   * @route POST /api/v1/users/device-token
   */
  async addDeviceToken(req, res, next) {
    try {
      const { token } = req.body;
      
      if (!token) {
        throw new AppError('Device token is required', 400, 'MISSING_TOKEN');
      }
      
      const tokens = await userService.addDeviceToken(req.user.id, token);
      
      return successResponse(res, { tokens }, 'Device token added');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove device token
   * @route DELETE /api/v1/users/device-token
   */
  async removeDeviceToken(req, res, next) {
    try {
      const { token } = req.body;
      
      if (!token) {
        throw new AppError('Device token is required', 400, 'MISSING_TOKEN');
      }
      
      const tokens = await userService.removeDeviceToken(req.user.id, token);
      
      return successResponse(res, { tokens }, 'Device token removed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate account
   * @route POST /api/v1/users/deactivate
   */
  async deactivateAccount(req, res, next) {
    try {
      const { reason, password } = req.body;
      
      if (!password) {
        throw new AppError('Password is required for deactivation', 400, 'MISSING_PASSWORD');
      }
      
      // Verify password
      const user = await userService.getUserByEmail(req.user.email, true);
      const isPasswordCorrect = await user.comparePassword(password);
      
      if (!isPasswordCorrect) {
        throw new AppError('Incorrect password', 401, 'INVALID_PASSWORD');
      }
      
      await userService.deactivateAccount(req.user.id, reason || 'User requested');
      
      return successResponse(res, null, 'Account deactivated successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();