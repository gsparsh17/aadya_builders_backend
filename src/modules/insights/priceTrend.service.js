const Property = require('../properties/property.model');
const searchFilters = require('../search/search.filters');
const logger = require('../../utils/logger');

/**
 * Price Trend Service - Handles price trend analysis
 */
class PriceTrendService {
  
  /**
   * Get price trends for a location
   */
  async getPriceTrends(params) {
    const { city, locality, propertyType, purpose, months = 12 } = params;
    
    const pipeline = searchFilters.buildPriceTrendsPipeline({
      city,
      locality,
      propertyType,
      purpose,
      months
    });
    
    const trends = await Property.aggregate(pipeline);
    
    // Format trends for response
    const formattedTrends = trends.map(item => ({
      year: item._id.year,
      month: item._id.month,
      monthName: this.getMonthName(item._id.month),
      avgPrice: Math.round(item.avgPrice),
      avgPricePerSqft: Math.round(item.avgPricePerSqft),
      minPrice: item.minPrice,
      maxPrice: item.maxPrice,
      count: item.count
    }));
    
    // Calculate trend direction and percentage change
    const trendAnalysis = this.analyzeTrend(formattedTrends);
    
    return {
      location: {
        city: city || 'All Cities',
        locality: locality || 'All Localities',
        propertyType: propertyType || 'All Types',
        purpose: purpose || 'All Purposes'
      },
      trends: formattedTrends,
      analysis: trendAnalysis
    };
  }

  /**
   * Analyze trend direction and changes
   */
  analyzeTrend(trends) {
    if (trends.length < 2) {
      return {
        direction: 'stable',
        percentageChange: 0,
        averagePrice: trends[0]?.avgPrice || 0,
        averagePricePerSqft: trends[0]?.avgPricePerSqft || 0
      };
    }
    
    const recent = trends.slice(-3);
    const previous = trends.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, t) => sum + t.avgPrice, 0) / recent.length;
    const previousAvg = previous.length > 0 
      ? previous.reduce((sum, t) => sum + t.avgPrice, 0) / previous.length 
      : recentAvg;
    
    const percentageChange = previousAvg > 0 
      ? ((recentAvg - previousAvg) / previousAvg) * 100 
      : 0;
    
    let direction = 'stable';
    if (percentageChange > 2) direction = 'up';
    else if (percentageChange < -2) direction = 'down';
    
    return {
      direction,
      percentageChange: Math.round(percentageChange * 10) / 10,
      averagePrice: Math.round(recentAvg),
      averagePricePerSqft: Math.round(
        recent.reduce((sum, t) => sum + t.avgPricePerSqft, 0) / recent.length
      )
    };
  }

  /**
   * Get month name
   */
  getMonthName(month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  }

  /**
   * Get locality analytics
   */
  async getLocalityAnalytics(city, locality) {
    const pipeline = searchFilters.buildLocalityAnalyticsPipeline(city, locality);
    
    const analytics = await Property.aggregate(pipeline);
    
    // Get summary statistics
    const summary = await Property.aggregate([
      {
        $match: {
          status: 'active',
          'location.city': { $regex: city, $options: 'i' },
          ...(locality && { 'location.locality': { $regex: locality, $options: 'i' } })
        }
      },
      {
        $group: {
          _id: null,
          totalListings: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          avgPricePerSqft: { $avg: '$pricePerSqft' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgArea: { $avg: '$area.value' }
        }
      }
    ]);
    
    return {
      location: { city, locality: locality || 'All' },
      summary: summary[0] || {},
      byType: analytics
    };
  }

  /**
   * Get market overview
   */
  async getMarketOverview() {
    const overview = await Property.aggregate([
      { $match: { status: 'active' } },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalListings: { $sum: 1 },
                avgPrice: { $avg: '$price' },
                avgPricePerSqft: { $avg: '$pricePerSqft' },
                totalValue: { $sum: '$price' }
              }
            }
          ],
          byCity: [
            {
              $group: {
                _id: '$location.city',
                listings: { $sum: 1 },
                avgPrice: { $avg: '$price' }
              }
            },
            { $sort: { listings: -1 } },
            { $limit: 10 }
          ],
          byPurpose: [
            {
              $group: {
                _id: '$purpose',
                listings: { $sum: 1 },
                avgPrice: { $avg: '$price' }
              }
            }
          ],
          byPropertyType: [
            {
              $group: {
                _id: '$propertyType',
                listings: { $sum: 1 },
                avgPrice: { $avg: '$price' }
              }
            },
            { $sort: { listings: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ]);
    
    return overview[0] || {};
  }

  /**
   * Get price comparison between localities
   */
  async compareLocalities(city, localities) {
    const localityList = localities.split(',').map(l => l.trim());
    
    const comparison = await Property.aggregate([
      {
        $match: {
          status: 'active',
          'location.city': { $regex: city, $options: 'i' },
          'location.locality': { $in: localityList.map(l => new RegExp(l, 'i')) }
        }
      },
      {
        $group: {
          _id: '$location.locality',
          avgPrice: { $avg: '$price' },
          avgPricePerSqft: { $avg: '$pricePerSqft' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          listings: { $sum: 1 }
        }
      },
      { $sort: { avgPrice: 1 } }
    ]);
    
    return {
      city,
      comparison
    };
  }

  /**
   * Get top performing localities
   */
  async getTopPerformingLocalities(city, limit = 10) {
    const localities = await Property.aggregate([
      {
        $match: {
          status: 'active',
          'location.city': { $regex: city, $options: 'i' }
        }
      },
      {
        $group: {
          _id: '$location.locality',
          avgPrice: { $avg: '$price' },
          avgPricePerSqft: { $avg: '$pricePerSqft' },
          listings: { $sum: 1 },
          totalViews: { $sum: '$views' },
          totalLeads: { $sum: '$leads' }
        }
      },
      {
        $addFields: {
          demandScore: {
            $add: [
              { $multiply: ['$totalLeads', 2] },
              '$totalViews'
            ]
          }
        }
      },
      { $sort: { demandScore: -1 } },
      { $limit: limit }
    ]);
    
    return localities;
  }
}

module.exports = new PriceTrendService();