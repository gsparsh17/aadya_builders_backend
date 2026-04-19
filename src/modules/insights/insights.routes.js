const express = require('express');
const router = express.Router();
const insightsController = require('./insights.controller');
const { query, body } = require('express-validator');
const { validate } = require('../../middlewares/validation.middleware');

// ==================== Price Trends ====================

/**
 * @route   GET /api/v1/insights/price-trends
 * @desc    Get price trends for a location
 * @access  Public
 */
router.get(
  '/price-trends',
  [
    query('city').notEmpty().withMessage('City is required'),
    query('locality').optional().isString(),
    query('propertyType').optional().isString(),
    query('purpose').optional().isIn(['buy', 'rent']),
    query('months').optional().isInt({ min: 1, max: 60 }),
    validate
  ],
  insightsController.getPriceTrends
);

/**
 * @route   GET /api/v1/insights/locality-analytics
 * @desc    Get locality analytics
 * @access  Public
 */
router.get(
  '/locality-analytics',
  [
    query('city').notEmpty().withMessage('City is required'),
    query('locality').optional().isString(),
    validate
  ],
  insightsController.getLocalityAnalytics
);

/**
 * @route   GET /api/v1/insights/market-overview
 * @desc    Get market overview
 * @access  Public
 */
router.get('/market-overview', insightsController.getMarketOverview);

/**
 * @route   GET /api/v1/insights/compare-localities
 * @desc    Compare localities
 * @access  Public
 */
router.get(
  '/compare-localities',
  [
    query('city').notEmpty().withMessage('City is required'),
    query('localities').notEmpty().withMessage('Localities are required'),
    validate
  ],
  insightsController.compareLocalities
);

/**
 * @route   GET /api/v1/insights/top-localities
 * @desc    Get top performing localities
 * @access  Public
 */
router.get(
  '/top-localities',
  [
    query('city').notEmpty().withMessage('City is required'),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    validate
  ],
  insightsController.getTopPerformingLocalities
);

// ==================== Calculators ====================

/**
 * @route   POST /api/v1/insights/emi-calculator
 * @desc    Calculate home loan EMI
 * @access  Public
 */
router.post(
  '/emi-calculator',
  [
    body('principal').isFloat({ min: 1 }).withMessage('Principal amount is required'),
    body('interestRate').isFloat({ min: 0.1, max: 30 }).withMessage('Interest rate is required'),
    body('tenure').isFloat({ min: 0.5, max: 40 }).withMessage('Tenure is required'),
    body('tenureUnit').optional().isIn(['years', 'months']),
    validate
  ],
  insightsController.calculateEMI
);

/**
 * @route   POST /api/v1/insights/affordability
 * @desc    Calculate affordability
 * @access  Public
 */
router.post(
  '/affordability',
  [
    body('monthlyIncome').isFloat({ min: 1 }).withMessage('Monthly income is required'),
    body('existingEMI').optional().isFloat({ min: 0 }),
    body('interestRate').optional().isFloat({ min: 0.1, max: 30 }),
    body('tenure').optional().isInt({ min: 1, max: 40 }),
    body('downPaymentPercentage').optional().isFloat({ min: 0, max: 100 }),
    validate
  ],
  insightsController.calculateAffordability
);

/**
 * @route   POST /api/v1/insights/area-converter
 * @desc    Convert area units
 * @access  Public
 */
router.post(
  '/area-converter',
  [
    body('value').isFloat({ min: 0 }).withMessage('Value is required'),
    body('fromUnit').isIn(['sqft', 'sqyrd', 'sqm', 'acre', 'hectare', 'ground', 'cent', 'guntha', 'bigha']),
    body('toUnit').isIn(['sqft', 'sqyrd', 'sqm', 'acre', 'hectare', 'ground', 'cent', 'guntha', 'bigha']),
    validate
  ],
  insightsController.convertArea
);

/**
 * @route   POST /api/v1/insights/stamp-duty
 * @desc    Calculate stamp duty and registration
 * @access  Public
 */
router.post(
  '/stamp-duty',
  [
    body('propertyValue').isFloat({ min: 1 }).withMessage('Property value is required'),
    body('state').isString().withMessage('State is required'),
    body('gender').optional().isIn(['male', 'female']),
    body('isFirstHome').optional().isBoolean(),
    validate
  ],
  insightsController.calculateStampDuty
);

/**
 * @route   POST /api/v1/insights/rental-yield
 * @desc    Calculate rental yield
 * @access  Public
 */
router.post(
  '/rental-yield',
  [
    body('propertyValue').isFloat({ min: 1 }).withMessage('Property value is required'),
    body('monthlyRent').isFloat({ min: 1 }).withMessage('Monthly rent is required'),
    body('annualAppreciation').optional().isFloat({ min: 0, max: 20 }),
    validate
  ],
  insightsController.calculateRentalYield
);

/**
 * @route   POST /api/v1/insights/capital-gains
 * @desc    Calculate capital gains tax
 * @access  Public
 */
router.post(
  '/capital-gains',
  [
    body('purchasePrice').isFloat({ min: 1 }).withMessage('Purchase price is required'),
    body('purchaseYear').isInt({ min: 2001, max: new Date().getFullYear() }),
    body('salePrice').isFloat({ min: 1 }).withMessage('Sale price is required'),
    body('saleYear').isInt({ min: 2001, max: new Date().getFullYear() }),
    body('indexation').optional().isBoolean(),
    body('improvements').optional().isArray(),
    validate
  ],
  insightsController.calculateCapitalGains
);

module.exports = router;