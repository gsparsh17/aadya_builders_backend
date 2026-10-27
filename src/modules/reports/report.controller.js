const Report = require('./report.model');
const Property = require('../properties/property.model');
const { successResponse, paginatedResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');

class ReportController {
  /**
   * Report a listing
   * @route POST /api/v1/reports
   */
  async create(req, res, next) {
    try {
      const { propertyId, reason, details } = req.body;
      const property = await Property.findById(propertyId).select('_id owner');
      if (!property) throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      if (property.owner?.toString() === req.user.id) {
        throw new AppError('You cannot report your own listing', 400, 'SELF_REPORT');
      }

      const report = await Report.findOneAndUpdate(
        { property: propertyId, reporter: req.user.id },
        { reason, details, status: 'open' },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return successResponse(res, report, 'Thanks — our team will review this listing', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: list reports, newest first, with how many reports each listing has
   * @route GET /api/v1/reports/admin?status=open
   */
  async adminList(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const filter = req.query.status ? { status: req.query.status } : {};
      const [reports, total] = await Promise.all([
        Report.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('property', 'title propertyCode status location.city owner')
          .populate('reporter', 'name phone'),
        Report.countDocuments(filter),
      ]);
      return paginatedResponse(res, reports, page, limit, total, 'Reports retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: resolve or dismiss a report
   * @route PUT /api/v1/reports/admin/:id
   */
  async adminUpdate(req, res, next) {
    try {
      const { status, resolution, deactivateListing } = req.body;
      const report = await Report.findByIdAndUpdate(
        req.params.id,
        { status, resolution, resolvedBy: req.user.id, resolvedAt: new Date() },
        { new: true },
      );
      if (!report) throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
      if (deactivateListing) {
        await Property.findByIdAndUpdate(report.property, { status: 'inactive' });
      }
      return successResponse(res, report, 'Report updated');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportController();
