const searchService = require('./search.service');
const { successResponse, paginatedResponse, errorResponse } = require('../../utils/responseHandler');
const logger = require('../../utils/logger');
const { validationResult } = require('express-validator');

/**
 * Search Controller - Handles HTTP requests for search operations
 */
class SearchController {
  
  /**
   * Advanced property search
   * @route GET /api/v1/search
   */
  async search(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const useCache = req.query.cache !== 'false';
      
      const result = await searchService.searchProperties(req.query, page, limit, useCache);
      
      // Track search for logged-in users
      if (req.user && Object.keys(req.query).length > 0) {
        searchService.saveSearch(req.user.id, {
          filters: req.query
        }).catch(err => logger.error('Failed to save search:', err));
      }
      
      return paginatedResponse(res, result.properties, page, limit, result.total, 'Search results retrieved successfully', {
        facets: result.facets
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get search facets/aggregations
   * @route GET /api/v1/search/facets
   */
  async getFacets(req, res, next) {
    try {
      const facets = await searchService.getSearchFacets(req.query);
      
      return successResponse(res, facets, 'Facets retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Autocomplete suggestions
   * @route GET /api/v1/search/autocomplete
   */
  async autocomplete(req, res, next) {
    try {
      const { q, type, limit } = req.query;
      
      if (!q) {
        return successResponse(res, [], 'No query provided');
      }
      
      const suggestions = await searchService.getAutocompleteSuggestions(
        q,
        type || 'all',
        parseInt(limit) || 10
      );
      
      return successResponse(res, suggestions, 'Suggestions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Location autocomplete
   * @route GET /api/v1/search/locations
   */
  async locationAutocomplete(req, res, next) {
    try {
      const { q, limit } = req.query;
      
      if (!q) {
        return successResponse(res, [], 'No query provided');
      }
      
      const suggestions = await searchService.getLocationSuggestions(
        q,
        parseInt(limit) || 10
      );
      
      return successResponse(res, suggestions, 'Location suggestions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search by property code
   * @route GET /api/v1/search/by-code/:code
   */
  async searchByCode(req, res, next) {
    try {
      const { code } = req.params;
      
      const property = await searchService.searchByPropertyCode(code);
      
      return successResponse(res, property, 'Property found successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get personalized suggestions
   * @route GET /api/v1/search/personalized
   */
  async getPersonalizedSuggestions(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      let suggestions;
      if (req.user) {
        suggestions = await searchService.getPersonalizedSuggestions(req.user.id, limit);
      } else {
        suggestions = await searchService.getTrendingSearches(limit);
      }
      
      return successResponse(res, suggestions, 'Suggestions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get trending searches
   * @route GET /api/v1/search/trending
   */
  async getTrendingSearches(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      const trending = await searchService.getTrendingSearches(limit);
      
      return successResponse(res, trending, 'Trending searches retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent searches for user
   * @route GET /api/v1/search/recent
   */
  async getRecentSearches(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      
      const recent = await searchService.getRecentSearches(req.user.id, limit);
      
      return successResponse(res, recent, 'Recent searches retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Save search
   * @route POST /api/v1/search/save
   */
  async saveSearch(req, res, next) {
    try {
      const { name, filters } = req.body;
      
      if (!filters) {
        return errorResponse(res, 'Filters are required', 400, 'FILTERS_REQUIRED');
      }
      
      const savedSearches = await searchService.saveSearch(req.user.id, { name, filters });
      
      return successResponse(res, savedSearches, 'Search saved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get similar searches
   * @route GET /api/v1/search/similar
   */
  async getSimilarSearches(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      
      const similar = await searchService.getSimilarSearches(req.query, limit);
      
      return successResponse(res, similar, 'Similar searches retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get cities list
   * @route GET /api/v1/search/cities
   */
  async getCities(req, res, next) {
    try {
      const Property = require('../properties/property.model');
      
      const cities = await Property.distinct('location.city', { status: 'active' });
      
      return successResponse(res, cities.sort(), 'Cities retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get localities by city
   * @route GET /api/v1/search/localities/:city
   */
  async getLocalitiesByCity(req, res, next) {
    try {
      const { city } = req.params;
      const Property = require('../properties/property.model');
      
      const localities = await Property.distinct('location.locality', {
        'location.city': { $regex: city, $options: 'i' },
        status: 'active'
      });
      
      return successResponse(res, localities.sort(), 'Localities retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SearchController();