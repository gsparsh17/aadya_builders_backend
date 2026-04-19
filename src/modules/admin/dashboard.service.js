const User = require('../users/user.model');
const Property = require('../properties/property.model');
const Lead = require('../leads/lead.model');
const Transaction = require('../payments/transaction.model');
const Article = require('../content/article.model');
const SubscriptionPlan = require('../payments/subscription.model');
const logger = require('../../utils/logger');

/**
 * Dashboard Service - Handles admin dashboard analytics
 */
class DashboardService {
  
  /**
   * Get dashboard overview statistics
   */
  async getOverviewStats(dateRange = {}) {
    const dateFilter = this.buildDateFilter(dateRange);
    
    const [
      userStats,
      propertyStats,
      leadStats,
      revenueStats,
      contentStats
    ] = await Promise.all([
      this.getUserStats(dateFilter),
      this.getPropertyStats(dateFilter),
      this.getLeadStats(dateFilter),
      this.getRevenueStats(dateFilter),
      this.getContentStats(dateFilter)
    ]);
    
    return {
      users: userStats,
      properties: propertyStats,
      leads: leadStats,
      revenue: revenueStats,
      content: contentStats,
      period: dateRange
    };
  }

  /**
   * Build date filter
   */
  buildDateFilter(dateRange) {
    const filter = {};
    
    if (dateRange.startDate) {
      filter.$gte = new Date(dateRange.startDate);
    }
    
    if (dateRange.endDate) {
      filter.$lte = new Date(dateRange.endDate);
    }
    
    return filter;
  }

  /**
   * Get user statistics
   */
  async getUserStats(dateFilter) {
    const matchStage = {};
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }
    
    const stats = await User.aggregate([
      { $match: matchStage },
      { $facet: {
        overview: [
          { $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
            verifiedUsers: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } }
          }}
        ],
        byRole: [
          { $group: {
            _id: '$role',
            count: { $sum: 1 }
          }},
          { $sort: { count: -1 } }
        ],
        byDay: [
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }},
          { $sort: { _id: 1 } }
        ],
        topCities: [
          { $group: {
            _id: '$address.city',
            count: { $sum: 1 }
          }},
          { $match: { _id: { $ne: null } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]
      }}
    ]);
    
    return stats[0] || {};
  }

  /**
   * Get property statistics
   */
  async getPropertyStats(dateFilter) {
    const matchStage = {};
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }
    
    const stats = await Property.aggregate([
      { $match: matchStage },
      { $facet: {
        overview: [
          { $group: {
            _id: null,
            totalProperties: { $sum: 1 },
            activeProperties: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            pendingProperties: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            soldProperties: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } },
            rentedProperties: { $sum: { $cond: [{ $eq: ['$status', 'rented'] }, 1, 0] } },
            totalViews: { $sum: '$views' },
            totalLeads: { $sum: '$leads' },
            avgPrice: { $avg: '$price' }
          }}
        ],
        byPurpose: [
          { $group: {
            _id: '$purpose',
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' }
          }},
          { $sort: { count: -1 } }
        ],
        byCity: [
          { $group: {
            _id: '$location.city',
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' }
          }},
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],
        byType: [
          { $group: {
            _id: '$propertyType',
            count: { $sum: 1 }
          }},
          { $sort: { count: -1 } }
        ],
        verificationStatus: [
          { $group: {
            _id: '$isVerified',
            count: { $sum: 1 }
          }}
        ],
        byDay: [
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }},
          { $sort: { _id: 1 } }
        ]
      }}
    ]);
    
    return stats[0] || {};
  }

  /**
   * Get lead statistics
   */
  async getLeadStats(dateFilter) {
    const matchStage = {};
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }
    
    const stats = await Lead.aggregate([
      { $match: matchStage },
      { $facet: {
        overview: [
          { $group: {
            _id: null,
            totalLeads: { $sum: 1 },
            spamLeads: { $sum: { $cond: [{ $eq: ['$isSpam', true] }, 1, 0] } },
            avgSpamScore: { $avg: '$spamScore' }
          }}
        ],
        byStatus: [
          { $group: {
            _id: '$status',
            count: { $sum: 1 }
          }},
          { $sort: { count: -1 } }
        ],
        byDay: [
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }},
          { $sort: { _id: 1 } }
        ],
        conversionFunnel: [
          { $group: {
            _id: null,
            total: { $sum: 1 },
            contacted: { $sum: { $cond: [{ $in: ['$status', ['contacted', 'negotiating', 'site_visit_scheduled', 'site_visit_done', 'offer_made', 'closed_won']] }, 1, 0] } },
            siteVisit: { $sum: { $cond: [{ $in: ['$status', ['site_visit_scheduled', 'site_visit_done']] }, 1, 0] } },
            offerMade: { $sum: { $cond: [{ $eq: ['$status', 'offer_made'] }, 1, 0] } },
            closed: { $sum: { $cond: [{ $eq: ['$status', 'closed_won'] }, 1, 0] } }
          }}
        ]
      }}
    ]);
    
    return stats[0] || {};
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStats(dateFilter) {
    const matchStage = { status: 'captured' };
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }
    
    const stats = await Transaction.aggregate([
      { $match: matchStage },
      { $facet: {
        overview: [
          { $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalTransactions: { $sum: 1 },
            avgTransactionValue: { $avg: '$amount' },
            maxTransaction: { $max: '$amount' }
          }}
        ],
        byType: [
          { $group: {
            _id: '$transactionType',
            revenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }},
          { $sort: { revenue: -1 } }
        ],
        byMonth: [
          { $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }},
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 12 }
        ],
        byPaymentMethod: [
          { $group: {
            _id: '$paymentMethod',
            revenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }},
          { $sort: { revenue: -1 } }
        ]
      }}
    ]);
    
    return stats[0] || {};
  }

  /**
   * Get content statistics
   */
  async getContentStats(dateFilter) {
    const matchStage = {};
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }
    
    const stats = await Article.aggregate([
      { $match: matchStage },
      { $facet: {
        overview: [
          { $group: {
            _id: null,
            totalArticles: { $sum: 1 },
            publishedArticles: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
            totalViews: { $sum: '$views' },
            avgViews: { $avg: '$views' }
          }}
        ],
        byCategory: [
          { $match: { status: 'published' } },
          { $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgViews: { $avg: '$views' }
          }},
          { $sort: { count: -1 } }
        ]
      }}
    ]);
    
    return stats[0] || {};
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit = 20) {
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');
    
    const recentProperties = await Property.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title price location.city status createdAt')
      .populate('owner', 'name');
    
    const recentLeads = await Lead.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('property', 'title')
      .populate('buyer', 'name')
      .select('status createdAt');
    
    const recentTransactions = await Transaction.find({ status: 'captured' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name')
      .select('amount transactionType createdAt');
    
    return {
      users: recentUsers,
      properties: recentProperties,
      leads: recentLeads,
      transactions: recentTransactions
    };
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals() {
    const [pendingProperties, pendingUsers, pendingArticles] = await Promise.all([
      Property.countDocuments({ status: 'pending' }),
      User.countDocuments({ 'verificationDocuments.verified': false }),
      Article.countDocuments({ status: 'pending_review' })
    ]);
    
    return {
      properties: pendingProperties,
      users: pendingUsers,
      articles: pendingArticles,
      total: pendingProperties + pendingUsers + pendingArticles
    };
  }

  /**
   * Get top performers
   */
  async getTopPerformers() {
    const topDealers = await User.aggregate([
      { $match: { role: { $in: ['dealer', 'builder'] } } },
      { $lookup: {
        from: 'properties',
        localField: '_id',
        foreignField: 'owner',
        as: 'properties'
      }},
      { $lookup: {
        from: 'leads',
        localField: '_id',
        foreignField: 'owner',
        as: 'leads'
      }},
      { $addFields: {
        propertyCount: { $size: '$properties' },
        leadCount: { $size: '$leads' },
        totalViews: { $sum: '$properties.views' }
      }},
      { $project: {
        name: 1,
        email: 1,
        role: 1,
        companyDetails: 1,
        propertyCount: 1,
        leadCount: 1,
        totalViews: 1
      }},
      { $sort: { propertyCount: -1, leadCount: -1 } },
      { $limit: 10 }
    ]);
    
    return topDealers;
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth() {
    const mongoose = require('mongoose');
    const redisClient = require('../../config/redis');
    
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    let redisStatus = 'disconnected';
    try {
      const client = await redisClient.getRedisClient();
      await client.ping();
      redisStatus = 'connected';
    } catch (error) {
      redisStatus = 'disconnected';
    }
    
    const memoryUsage = process.memoryUsage();
    
    return {
      database: dbStatus,
      redis: redisStatus,
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB'
      },
      nodeVersion: process.version,
      environment: process.env.NODE_ENV
    };
  }

  /**
   * Get subscription analytics
   */
  async getSubscriptionAnalytics() {
    const plans = await SubscriptionPlan.find({ isActive: true });
    
    const activeSubscriptions = await User.aggregate([
      { $match: { 'subscription.isActive': true } },
      { $group: {
        _id: '$subscription.plan',
        count: { $sum: 1 }
      }},
      { $lookup: {
        from: 'subscriptionplans',
        localField: '_id',
        foreignField: '_id',
        as: 'plan'
      }},
      { $unwind: '$plan' },
      { $project: {
        planName: '$plan.name',
        count: 1,
        revenue: { $multiply: ['$count', '$plan.price'] }
      }}
    ]);
    
    const expiringSoon = await User.countDocuments({
      'subscription.isActive': true,
      'subscription.endDate': {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    
    return {
      plans,
      activeSubscriptions,
      expiringSoon
    };
  }

  /**
   * Export data for reports
   */
  async exportReport(type, dateRange) {
    const dateFilter = this.buildDateFilter(dateRange);
    
    switch (type) {
      case 'users':
        return await User.find({ createdAt: dateFilter }).select('-password').lean();
      case 'properties':
        return await Property.find({ createdAt: dateFilter })
          .populate('owner', 'name email')
          .lean();
      case 'leads':
        return await Lead.find({ createdAt: dateFilter })
          .populate('property', 'title')
          .populate('buyer', 'name email')
          .populate('owner', 'name email')
          .lean();
      case 'transactions':
        return await Transaction.find({ createdAt: dateFilter, status: 'captured' })
          .populate('user', 'name email')
          .lean();
      default:
        throw new Error('Invalid export type');
    }
  }
}

module.exports = new DashboardService();