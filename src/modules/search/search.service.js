const Property = require('../properties/property.model');
const User = require('../users/user.model');
const searchFilters = require('./search.filters');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const redisClient = require('../../config/redis');

/**
 * Search Service - Handles all search operations
 */
class SearchService {
  
  /**
   * Generate cache key for search query
   */
  generateCacheKey(params, page, limit) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});
    
    return `search:${JSON.stringify(sortedParams)}:${page}:${limit}`;
  }

  /**
   * Advanced property search
   */
  async searchProperties(params, page = 1, limit = 20, useCache = true) {
    try {
      const cacheKey = this.generateCacheKey(params, page, limit);
      
      // Try to get from cache
      if (useCache) {
        const cachedResult = await redisClient.getRedisClient().then(client => 
          client.get(cacheKey)
        ).catch(() => null);
        
        if (cachedResult) {
          logger.debug('Search results retrieved from cache');
          return JSON.parse(cachedResult);
        }
      }
      
      // Build query
      const query = searchFilters.buildQuery(params);
      
      // Build sort options
      const sortOptions = searchFilters.buildSortOptions(params.sort);
      
      // Execute query
      const skip = (page - 1) * limit;
      
      const [properties, total] = await Promise.all([
        Property.find(query)
          .populate('owner', 'name profilePicture role isVerified companyDetails')
          .populate('project', 'name builder possessionDate')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Property.countDocuments(query)
      ]);
      
      // Add primary image field
      properties.forEach(property => {
        property.primaryImage = property.images?.find(img => img.isPrimary)?.url || 
                                property.images?.[0]?.url || null;
      });
      
      // Get facets/aggregations for filters
      const facets = await this.getSearchFacets(params);
      
      const result = {
        properties,
        facets,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
      
      // Cache result for 5 minutes
      if (useCache) {
        redisClient.getRedisClient().then(client => 
          client.setEx(cacheKey, 300, JSON.stringify(result))
        ).catch(err => logger.error('Failed to cache search results:', err));
      }
      
      return result;
    } catch (error) {
      logger.error('Search error:', error);
      throw new AppError('Search failed', 500, 'SEARCH_ERROR');
    }
  }

  /**
   * Get search facets (aggregations for filters)
   */
  async getSearchFacets(params) {
    const baseQuery = searchFilters.buildQuery({ ...params, page: undefined, limit: undefined });
    
    const facets = await Property.aggregate([
      { $match: baseQuery },
      {
        $facet: {
          // Property types distribution
          propertyTypes: [
            { $group: { _id: '$propertyType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          // Purpose distribution
          purposes: [
            { $group: { _id: '$purpose', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          // BHK distribution
          bhkDistribution: [
            { $match: { bedrooms: { $exists: true, $ne: null } } },
            {
              $group: {
                _id: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$bedrooms', 1] }, then: '1 BHK' },
                      { case: { $eq: ['$bedrooms', 2] }, then: '2 BHK' },
                      { case: { $eq: ['$bedrooms', 3] }, then: '3 BHK' },
                      { case: { $eq: ['$bedrooms', 4] }, then: '4 BHK' }
                    ],
                    default: '4+ BHK'
                  }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          // Price ranges
          priceRanges: [
            {
              $bucket: {
                groupBy: '$price',
                boundaries: [0, 1000000, 2500000, 5000000, 10000000, 20000000, 50000000, 100000000, Infinity],
                default: 'Other',
                output: { count: { $sum: 1 } }
              }
            }
          ],
          // Furnishing distribution
          furnishing: [
            { $match: { furnishing: { $exists: true } } },
            { $group: { _id: '$furnishing', count: { $sum: 1 } } }
          ],
          // Top cities
          cities: [
            { $group: { _id: '$location.city', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
          ],
          // Top localities
          localities: [
            { $group: { _id: '$location.locality', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
          ],
          // Price stats
          priceStats: [
            {
              $group: {
                _id: null,
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
                avgPrice: { $avg: '$price' }
              }
            }
          ],
          // Area stats
          areaStats: [
            {
              $group: {
                _id: null,
                minArea: { $min: '$area.value' },
                maxArea: { $max: '$area.value' },
                avgArea: { $avg: '$area.value' }
              }
            }
          ]
        }
      }
    ]);
    
    return facets[0] || {};
  }

  /**
   * Autocomplete suggestions
   */
  async getAutocompleteSuggestions(query, type = 'all', limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }
    
    const suggestions = [];
    const searchRegex = { $regex: `^${query}`, $options: 'i' };
    
    if (type === 'all' || type === 'locality') {
      const localities = await Property.distinct('location.locality', {
        'location.locality': searchRegex,
        status: 'active'
      });
      
      localities.slice(0, limit).forEach(locality => {
        suggestions.push({
          type: 'locality',
          text: locality,
          highlight: query
        });
      });
    }
    
    if (type === 'all' || type === 'city') {
      const cities = await Property.distinct('location.city', {
        'location.city': searchRegex,
        status: 'active'
      });
      
      cities.slice(0, limit).forEach(city => {
        suggestions.push({
          type: 'city',
          text: city,
          highlight: query
        });
      });
    }
    
    if (type === 'all' || type === 'project') {
      const projects = await Property.distinct('project', {
        status: 'active'
      });
      
      // Lookup project names
      const Project = require('../properties/property.model').db.model('Project');
      const projectResults = await Project.find({
        name: searchRegex,
        _id: { $in: projects }
      }).limit(limit);
      
      projectResults.forEach(project => {
        suggestions.push({
          type: 'project',
          text: project.name,
          id: project._id,
          highlight: query
        });
      });
    }
    
    if (type === 'all' || type === 'society') {
      const societies = await Property.distinct('title', {
        title: searchRegex,
        status: 'active'
      });
      
      societies.slice(0, limit).forEach(society => {
        suggestions.push({
          type: 'society',
          text: society,
          highlight: query
        });
      });
    }
    
    return suggestions.slice(0, limit);
  }

  /**
   * Search by property code
   */
  async searchByPropertyCode(code) {
    const property = await Property.findOne({
      propertyCode: { $regex: code, $options: 'i' },
      status: 'active'
    }).populate('owner', 'name profilePicture role isVerified');
    
    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }
    
    return property;
  }

  /**
   * Get search suggestions based on user preferences
   */
  async getPersonalizedSuggestions(userId, limit = 10) {
    const user = await User.findById(userId);
    
    if (!user || !user.preferences) {
      return await this.getTrendingSearches(limit);
    }
    
    const { preferredLocations, propertyTypes, budgetRange } = user.preferences;
    
    const query = { status: 'active' };
    
    if (preferredLocations && preferredLocations.length > 0) {
      const cities = preferredLocations.map(loc => loc.city);
      query['location.city'] = { $in: cities.map(c => new RegExp(c, 'i')) };
    }
    
    if (propertyTypes && propertyTypes.length > 0) {
      query.propertyType = { $in: propertyTypes };
    }
    
    if (budgetRange) {
      query.price = {
        $gte: budgetRange.min || 0,
        $lte: budgetRange.max || Infinity
      };
    }
    
    const properties = await Property.find(query)
      .sort({ rankingScore: -1 })
      .limit(limit)
      .select('title price location primaryImage propertyCode');
    
    return properties;
  }

  /**
   * Get trending searches
   */
  async getTrendingSearches(limit = 10) {
    // This would typically use a separate collection tracking search queries
    const trendingCities = ['Mumbai', 'Bangalore', 'Delhi', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata'];
    const trendingLocalities = ['Andheri', 'Whitefield', 'Dwarka', 'Kharadi', 'Gachibowli'];
    
    return {
      cities: trendingCities.slice(0, limit),
      localities: trendingLocalities.slice(0, limit)
    };
  }

  /**
   * Get location suggestions for autocomplete
   */
  async getLocationSuggestions(query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }
    
    const pipeline = [
      {
        $match: {
          status: 'active',
          $or: [
            { 'location.city': { $regex: `^${query}`, $options: 'i' } },
            { 'location.locality': { $regex: `^${query}`, $options: 'i' } }
          ]
        }
      },
      {
        $group: {
          _id: {
            city: '$location.city',
            locality: '$location.locality'
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          city: '$_id.city',
          locality: '$_id.locality',
          count: 1,
          displayText: {
            $concat: ['$_id.locality', ', ', '$_id.city']
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ];
    
    const results = await Property.aggregate(pipeline);
    
    return results;
  }

  /**
   * Get recently searched properties (for user)
   */
  async getRecentSearches(userId, limit = 5) {
    // This would typically be stored in user's search history
    const user = await User.findById(userId);
    
    if (!user || !user.recentSearches) {
      return [];
    }
    
    return user.recentSearches.slice(0, limit);
  }

  /**
   * Save search query
   */
  async saveSearch(userId, searchData) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    const searchEntry = {
      name: searchData.name || `Search ${new Date().toLocaleDateString()}`,
      filters: searchData.filters,
      createdAt: new Date()
    };
    
    user.savedSearches = user.savedSearches || [];
    user.savedSearches.unshift(searchEntry);
    
    // Limit to 20 saved searches
    if (user.savedSearches.length > 20) {
      user.savedSearches = user.savedSearches.slice(0, 20);
    }
    
    await user.save();
    
    return user.savedSearches;
  }

  /**
   * Get similar searches
   */
  async getSimilarSearches(filters, limit = 5) {
    // Find properties matching the filters
    const query = searchFilters.buildQuery(filters);
    
    const properties = await Property.find(query)
      .limit(limit)
      .select('location.city location.locality');
    
    // Extract common cities/localities
    const cities = [...new Set(properties.map(p => p.location.city))];
    const localities = [...new Set(properties.map(p => p.location.locality))];
    
    return {
      suggestedCities: cities.slice(0, 3),
      suggestedLocalities: localities.slice(0, 5)
    };
  }
}

module.exports = new SearchService();