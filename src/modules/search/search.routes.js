const express = require('express');
const router = express.Router();
const searchController = require('./search.controller');
const { optionalAuth } = require('../../middlewares/auth.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { query, param, body } = require('express-validator');
const { validate } = require('../../middlewares/validation.middleware');

// ==================== Public Routes ====================

/**
 * @route   GET /api/v1/search
 * @desc    Advanced property search
 * @access  Public (with optional auth)
 */
router.get(
  '/',
  optionalAuth,
  [
    query('purpose').optional().isIn(['buy', 'rent', 'new_launch', 'commercial_buy', 'commercial_lease', 'land']),
    query('propertyType').optional().isString(),
    query('city').optional().isString(),
    query('locality').optional().isString(),
    query('minPrice').optional().isFloat({ min: 0 }),
    query('maxPrice').optional().isFloat({ min: 0 }),
    query('minArea').optional().isFloat({ min: 0 }),
    query('maxArea').optional().isFloat({ min: 0 }),
    query('bhk').optional().isString(),
    query('furnishing').optional().isString(),
    query('amenities').optional().isString(),
    query('postedBy').optional().isIn(['individual', 'dealer', 'builder']),
    query('sort').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('latitude').optional().isFloat(),
    query('longitude').optional().isFloat(),
    query('radius').optional().isFloat({ min: 0.1, max: 50 }),
    query('q').optional().isString(),
    validate
  ],
  searchController.search
);

/**
 * @route   GET /api/v1/search/facets
 * @desc    Get search facets/aggregations
 * @access  Public
 */
router.get('/facets', searchController.getFacets);

/**
 * @route   GET /api/v1/search/autocomplete
 * @desc    Autocomplete suggestions
 * @access  Public
 */
router.get(
  '/autocomplete',
  [
    query('q').notEmpty().withMessage('Query is required').isString(),
    query('type').optional().isIn(['all', 'city', 'locality', 'project', 'society']),
    query('limit').optional().isInt({ min: 1, max: 20 }),
    validate
  ],
  searchController.autocomplete
);

/**
 * @route   GET /api/v1/search/locations
 * @desc    Location autocomplete
 * @access  Public
 */
router.get(
  '/locations',
  [
    query('q').notEmpty().withMessage('Query is required').isString(),
    query('limit').optional().isInt({ min: 1, max: 20 }),
    validate
  ],
  searchController.locationAutocomplete
);

/**
 * @route   GET /api/v1/search/by-code/:code
 * @desc    Search by property code
 * @access  Public
 */
router.get(
  '/by-code/:code',
  [
    param('code').notEmpty().withMessage('Property code is required'),
    validate
  ],
  searchController.searchByCode
);

/**
 * @route   GET /api/v1/search/trending
 * @desc    Get trending searches
 * @access  Public
 */
router.get(
  '/trending',
  [
    query('limit').optional().isInt({ min: 1, max: 20 }),
    validate
  ],
  searchController.getTrendingSearches
);

/**
 * @route   GET /api/v1/search/cities
 * @desc    Get all cities with properties
 * @access  Public
 */
router.get('/cities', searchController.getCities);

/**
 * @route   GET /api/v1/search/localities/:city
 * @desc    Get localities by city
 * @access  Public
 */
router.get(
  '/localities/:city',
  [
    param('city').notEmpty().withMessage('City is required'),
    validate
  ],
  searchController.getLocalitiesByCity
);

// ==================== Protected Routes ====================

/**
 * @route   GET /api/v1/search/personalized
 * @desc    Get personalized suggestions
 * @access  Private
 */
router.get(
  '/personalized',
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 20 }),
    validate
  ],
  searchController.getPersonalizedSuggestions
);

/**
 * @route   GET /api/v1/search/recent
 * @desc    Get recent searches for user
 * @access  Private
 */
router.get(
  '/recent',
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 20 }),
    validate
  ],
  searchController.getRecentSearches
);

/**
 * @route   POST /api/v1/search/save
 * @desc    Save search
 * @access  Private
 */
router.post(
  '/save',
  authMiddleware,
  [
    body('name').optional().isString().isLength({ max: 50 }),
    body('filters').isObject().withMessage('Filters are required'),
    validate
  ],
  searchController.saveSearch
);

/**
 * @route   GET /api/v1/search/similar
 * @desc    Get similar searches
 * @access  Public
 */
router.get(
  '/similar',
  [
    query('limit').optional().isInt({ min: 1, max: 10 }),
    validate
  ],
  searchController.getSimilarSearches
);

module.exports = router;