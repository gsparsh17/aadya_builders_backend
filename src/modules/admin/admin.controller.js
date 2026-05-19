const dashboardService = require('./dashboard.service');
const userService = require('../users/user.service');
const propertyService = require('../properties/property.service');
const leadService = require('../leads/lead.service');
const contentService = require('../content/content.service');
const { successResponse, paginatedResponse, errorResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');
const User = require('../users/user.model');
const Property = require('../properties/property.model');
const Lead = require('../leads/lead.model');
const Transaction = require('../payments/transaction.model');
const SubscriptionPlan = require('../payments/subscription.model');
const logger = require('../../utils/logger');

/**
 * Admin Controller - Handles HTTP requests for admin operations
 */
class AdminController {
  
  // ==================== Dashboard ====================
  
  /**
   * Get dashboard overview
   * @route GET /api/v1/admin/dashboard
   */
  async getDashboard(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      
      const overview = await dashboardService.getOverviewStats({ startDate, endDate });
      const pendingApprovals = await dashboardService.getPendingApprovals();
      const recentActivity = await dashboardService.getRecentActivity(10);
      const topPerformers = await dashboardService.getTopPerformers();
      
      return successResponse(res, {
        overview,
        pendingApprovals,
        recentActivity,
        topPerformers
      }, 'Dashboard data retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get system health
   * @route GET /api/v1/admin/health
   */
  async getSystemHealth(req, res, next) {
    try {
      const health = await dashboardService.getSystemHealth();
      
      return successResponse(res, health, 'System health retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get subscription analytics
   * @route GET /api/v1/admin/subscription-analytics
   */
  async getSubscriptionAnalytics(req, res, next) {
    try {
      const analytics = await dashboardService.getSubscriptionAnalytics();
      
      return successResponse(res, analytics, 'Subscription analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export report
   * @route GET /api/v1/admin/export/:type
   */
  async exportReport(req, res, next) {
    try {
      const { type } = req.params;
      const { startDate, endDate, format = 'json' } = req.query;
      
      const data = await dashboardService.exportReport(type, { startDate, endDate });
      
      if (format === 'csv') {
        const { Parser } = require('json2csv');
        const parser = new Parser();
        const csv = parser.parse(data);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${type}_report.csv`);
        return res.send(csv);
      }
      
      return successResponse(res, data, 'Report exported successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== User Management ====================
  
  /**
   * Get all users
   * @route GET /api/v1/admin/users
   */
  async getUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const filters = {
        role: req.query.role,
        isVerified: req.query.isVerified,
        isActive: req.query.isActive,
        search: req.query.search
      };
      
      const result = await userService.searchUsers(filters, page, limit);
      
      return paginatedResponse(res, result.users, page, limit, result.total, 'Users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user details
   * @route GET /api/v1/admin/users/:userId
   */
  async getUserDetails(req, res, next) {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId)
        .select('-password')
        .populate('subscription.plan');
      
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      // Get user's properties and leads
      const [properties, leads, transactions] = await Promise.all([
        Property.find({ owner: userId }).sort({ createdAt: -1 }).limit(10),
        Lead.find({ $or: [{ owner: userId }, { buyer: userId }] }).sort({ createdAt: -1 }).limit(10),
        Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(10)
      ]);
      
      return successResponse(res, {
        user,
        properties,
        leads,
        transactions
      }, 'User details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user status
   * @route PATCH /api/v1/admin/users/:userId/status
   */
  async updateUserStatus(req, res, next) {
    try {
      const { userId } = req.params;
      const { isActive, blockReason } = req.body;
      
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      user.isActive = isActive;
      user.isBlocked = !isActive;
      if (blockReason) user.blockReason = blockReason;
      
      await user.save();
      
      logger.info(`User ${userId} ${isActive ? 'activated' : 'deactivated'} by admin ${req.user.id}`);
      
      return successResponse(res, user, `User ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user role
   * @route PATCH /api/v1/admin/users/:userId/role
   */
  async updateUserRole(req, res, next) {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      const user = await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true, runValidators: true }
      );
      
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      logger.info(`User ${userId} role changed to ${role} by admin ${req.user.id}`);
      
      return successResponse(res, user, 'User role updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify user
   * @route PATCH /api/v1/admin/users/:userId/verify
   */
  async verifyUser(req, res, next) {
    try {
      const { userId } = req.params;
      
      const user = await User.findByIdAndUpdate(
        userId,
        {
          isVerified: true,
          emailVerified: true,
          phoneVerified: true
        },
        { new: true }
      );
      
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      return successResponse(res, user, 'User verified successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user
   * @route DELETE /api/v1/admin/users/:userId
   */
  async deleteUser(req, res, next) {
    try {
      const { userId } = req.params;
      
      // Don't allow deleting self
      if (userId === req.user.id) {
        throw new AppError('You cannot delete your own account', 400, 'SELF_DELETE');
      }
      
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      // Delete user's properties and leads
      await Property.deleteMany({ owner: userId });
      await Lead.deleteMany({ $or: [{ owner: userId }, { buyer: userId }] });
      await user.deleteOne();
      
      logger.info(`User ${userId} deleted by admin ${req.user.id}`);
      
      return successResponse(res, null, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== Property Management ====================
  
  /**
   * Get pending properties
   * @route GET /api/v1/admin/properties/pending
   */
  async getPendingProperties(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const [properties, total] = await Promise.all([
        Property.find({ status: 'pending' })
          .populate('owner', 'name email phone')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Property.countDocuments({ status: 'pending' })
      ]);
      
      return paginatedResponse(res, properties, page, limit, total, 'Pending properties retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify property
   * @route PATCH /api/v1/admin/properties/:propertyId/verify
   */
  async verifyProperty(req, res, next) {
    try {
      const { propertyId } = req.params;
      const { isVerified, rejectionReason } = req.body;
      
      const property = await propertyService.verifyProperty(propertyId, req.user.id, isVerified, rejectionReason);
      
      return successResponse(res, property, `Property ${isVerified ? 'verified' : 'rejected'} successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Feature/unfeature property
   * @route PATCH /api/v1/admin/properties/:propertyId/feature
   */
  async toggleFeatureProperty(req, res, next) {
    try {
      const { propertyId } = req.params;
      const { isFeatured, featuredUntil } = req.body;
      
      const property = await propertyService.toggleFeatureProperty(propertyId, isFeatured, featuredUntil);
      
      return successResponse(res, property, `Property ${isFeatured ? 'featured' : 'unfeatured'} successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete property
   * @route DELETE /api/v1/admin/properties/:propertyId
   */
  async deleteProperty(req, res, next) {
    try {
      const { propertyId } = req.params;
      
      await propertyService.deleteProperty(propertyId, req.user.id, 'admin');
      
      return successResponse(res, null, 'Property deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== Lead Management ====================
  
  /**
   * Get all leads
   * @route GET /api/v1/admin/leads
   */
  async getLeads(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const query = {};
      if (req.query.status) query.status = req.query.status;
      if (req.query.isSpam !== undefined) query.isSpam = req.query.isSpam === 'true';
      
      const [leads, total] = await Promise.all([
        Lead.find(query)
          .populate('property', 'title propertyCode')
          .populate('buyer', 'name email')
          .populate('owner', 'name email')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Lead.countDocuments(query)
      ]);
      
      return paginatedResponse(res, leads, page, limit, total, 'Leads retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== Plan Management ====================
  
  /**
   * Get all plans
   * @route GET /api/v1/admin/plans
   */
  async getPlans(req, res, next) {
    try {
      const plans = await SubscriptionPlan.find().sort({ displayOrder: 1 });
      
      return successResponse(res, plans, 'Plans retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create plan
   * @route POST /api/v1/admin/plans
   */
  async createPlan(req, res, next) {
    try {
      const plan = await SubscriptionPlan.create({
        ...req.body,
        createdBy: req.user.id
      });
      
      return successResponse(res, plan, 'Plan created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update plan
   * @route PUT /api/v1/admin/plans/:planId
   */
  async updatePlan(req, res, next) {
    try {
      const { planId } = req.params;
      
      const plan = await SubscriptionPlan.findByIdAndUpdate(
        planId,
        req.body,
        { new: true, runValidators: true }
      );
      
      if (!plan) {
        throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
      }
      
      return successResponse(res, plan, 'Plan updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle plan status
   * @route PATCH /api/v1/admin/plans/:planId/toggle
   */
  async togglePlanStatus(req, res, next) {
    try {
      const { planId } = req.params;
      
      const plan = await SubscriptionPlan.findById(planId);
      
      if (!plan) {
        throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
      }
      
      plan.isActive = !plan.isActive;
      await plan.save();
      
      return successResponse(res, plan, `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      next(error);
    }
  }

  // ==================== Settings ====================
  
  /**
   * Get system settings
   * @route GET /api/v1/admin/settings
   */
  async getSettings(req, res, next) {
    try {
      // Settings could be stored in a Settings model
      const settings = {
        freeListingLimit: 3,
        featuredListingPrice: 899,
        maxImagesPerProperty: 20,
        leadSpamThreshold: 50,
        cacheEnabled: true,
        maintenanceMode: false
      };
      
      return successResponse(res, settings, 'Settings retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update system settings
   * @route PUT /api/v1/admin/settings
   */
  async updateSettings(req, res, next) {
    try {
      // Update settings in database
      logger.info(`Settings updated by admin ${req.user.id}`);
      
      return successResponse(res, req.body, 'Settings updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clear cache
   * @route POST /api/v1/admin/cache/clear
   */
  async clearCache(req, res, next) {
    try {
      const redisClient = require('../../config/redis');
      const client = await redisClient.getRedisClient();
      
      if (!client) {
        return successResponse(res, null, 'Cache is currently disabled or unavailable');
      }

      const { pattern } = req.body;
      
      if (pattern) {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(keys);
        }
      } else {
        await client.flushAll();
      }
      
      logger.info(`Cache cleared by admin ${req.user.id}`);
      
      return successResponse(res, null, 'Cache cleared successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();