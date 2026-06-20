const priceTrendService = require('./priceTrend.service');
const calculatorService = require('./calculator.service');
const { successResponse, errorResponse } = require('../../utils/responseHandler');
const { validationResult } = require('express-validator');
const Property = require('../properties/property.model');

/**
 * Insights Controller - Handles HTTP requests for insights and calculators
 */
class InsightsController {
  
  // ==================== Price Trends ====================
  
  /**
   * Get price trends
   * @route GET /api/v1/insights/price-trends
   */
  async getPriceTrends(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const trends = await priceTrendService.getPriceTrends(req.query);
      
      return successResponse(res, trends, 'Price trends retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get locality analytics
   * @route GET /api/v1/insights/locality-analytics
   */
  async getLocalityAnalytics(req, res, next) {
    try {
      const { city, locality } = req.query;
      
      if (!city) {
        return errorResponse(res, 'City is required', 400, 'CITY_REQUIRED');
      }
      
      const analytics = await priceTrendService.getLocalityAnalytics(city, locality);
      
      return successResponse(res, analytics, 'Locality analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get market overview
   * @route GET /api/v1/insights/market-overview
   */
  async getMarketOverview(req, res, next) {
    try {
      const { city } = req.query;
      const overview = await priceTrendService.getMarketOverview(city);
      
      return successResponse(res, overview, 'Market overview retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Compare localities
   * @route GET /api/v1/insights/compare-localities
   */
  async compareLocalities(req, res, next) {
    try {
      const { city, localities } = req.query;
      
      if (!city || !localities) {
        return errorResponse(res, 'City and localities are required', 400, 'MISSING_PARAMS');
      }
      
      const comparison = await priceTrendService.compareLocalities(city, localities);
      
      return successResponse(res, comparison, 'Locality comparison retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get top performing localities
   * @route GET /api/v1/insights/top-localities
   */
  async getTopPerformingLocalities(req, res, next) {
    try {
      const { city, limit = 10 } = req.query;
      
      if (!city) {
        return errorResponse(res, 'City is required', 400, 'CITY_REQUIRED');
      }
      
      const localities = await priceTrendService.getTopPerformingLocalities(city, parseInt(limit));
      
      return successResponse(res, localities, 'Top localities retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== Calculators ====================
  
  /**
   * Calculate EMI
   * @route POST /api/v1/insights/emi-calculator
   */
  async calculateEMI(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const result = calculatorService.calculateEMI(req.body);
      
      return successResponse(res, result, 'EMI calculated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate affordability
   * @route POST /api/v1/insights/affordability
   */
  async calculateAffordability(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const result = calculatorService.calculateAffordability(req.body);
      
      return successResponse(res, result, 'Affordability calculated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Convert area
   * @route POST /api/v1/insights/area-converter
   */
  async convertArea(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const result = calculatorService.convertArea(req.body);
      
      return successResponse(res, result, 'Area converted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate stamp duty
   * @route POST /api/v1/insights/stamp-duty
   */
  async calculateStampDuty(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const result = calculatorService.calculateStampDuty(req.body);
      
      return successResponse(res, result, 'Stamp duty calculated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate rental yield
   * @route POST /api/v1/insights/rental-yield
   */
  async calculateRentalYield(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const result = calculatorService.calculateRentalYield(req.body);
      
      return successResponse(res, result, 'Rental yield calculated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate capital gains
   * @route POST /api/v1/insights/capital-gains
   */
  async calculateCapitalGains(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const result = calculatorService.calculateCapitalGains(req.body);
      
      return successResponse(res, result, 'Capital gains calculated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get top gainers for mobile locality cards
   * @route GET /api/v1/insights/top-gainers
   */
  async getTopGainers(req, res, next) {
    try {
      const { city, period = '1Y', limit = 10 } = req.query;
      const match = { status: 'active' };
      if (city) match['location.city'] = { $regex: `^${String(city).trim()}$`, $options: 'i' };
      const rows = await Property.aggregate([
        { $match: match },
        { $group: {
          _id: '$location.locality',
          avgPricePerSqft: { $avg: '$pricePerSqft' },
          listingsCount: { $sum: 1 }
        } },
        { $sort: { avgPricePerSqft: -1, listingsCount: -1 } },
        { $limit: parseInt(limit) }
      ]);
      return successResponse(res, rows.filter(r => r._id).map((r, index) => ({
        rank: index + 1,
        locality: r._id,
        city,
        avgPricePerSqft: Math.round(r.avgPricePerSqft || 0),
        appreciationPercent: 0,
        listingsCount: r.listingsCount,
        period
      })), 'Top gainers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get calculator/tool cards for the app
   * @route GET /api/v1/insights/tools
   */
  async getTools(req, res, next) {
    try {
      return successResponse(res, [
        { key: 'eligibility', title: 'Check Eligibility', icon: 'check', endpoint: '/api/v1/insights/affordability' },
        { key: 'emi', title: 'EMI Calculator', icon: 'calculator', endpoint: '/api/v1/insights/emi-calculator' },
        { key: 'area_converter', title: 'Area Converter', icon: 'area', endpoint: '/api/v1/insights/area-converter' },
        { key: 'stamp_duty', title: 'Stamp Duty', icon: 'document', endpoint: '/api/v1/insights/stamp-duty' },
        { key: 'rental_yield', title: 'Rental Yield', icon: 'percent', endpoint: '/api/v1/insights/rental-yield' }
      ], 'Popular tools retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

}

module.exports = new InsightsController();