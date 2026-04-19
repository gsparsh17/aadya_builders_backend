const priceTrendService = require('./priceTrend.service');
const calculatorService = require('./calculator.service');
const { successResponse, errorResponse } = require('../../utils/responseHandler');
const { validationResult } = require('express-validator');

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
      const overview = await priceTrendService.getMarketOverview();
      
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
}

module.exports = new InsightsController();