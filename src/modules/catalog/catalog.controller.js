const Property = require('../properties/property.model');
const { successResponse } = require('../../utils/responseHandler');
const {
  PROPERTY_TYPES,
  SEGMENTS,
  SORT_OPTIONS,
  FURNISHING_OPTIONS,
  POSTED_BY_OPTIONS,
  CONSTRUCTION_STATUS_OPTIONS,
} = require('./catalog.config');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class CatalogController {
  /**
   * Full catalog with live listing counts
   * @route GET /api/v1/catalog?city=Lucknow
   */
  async getCatalog(req, res, next) {
    try {
      const match = { status: 'active' };
      if (req.query.city) {
        match['location.city'] = { $regex: `^${escapeRegex(req.query.city.trim())}$`, $options: 'i' };
      }

      const groups = await Property.aggregate([
        { $match: match },
        { $group: { _id: { purpose: '$purpose', propertyType: '$propertyType' }, count: { $sum: 1 } } },
      ]);

      const counts = {};
      for (const segment of SEGMENTS) {
        const byType = {};
        let total = 0;
        for (const { _id, count } of groups) {
          if (segment.purposes.includes(_id.purpose) && segment.propertyTypes.includes(_id.propertyType)) {
            byType[_id.propertyType] = (byType[_id.propertyType] || 0) + count;
            total += count;
          }
        }
        counts[segment.key] = { total, byType };
      }

      return successResponse(res, {
        segments: SEGMENTS,
        propertyTypes: PROPERTY_TYPES,
        sortOptions: SORT_OPTIONS,
        furnishingOptions: FURNISHING_OPTIONS,
        postedByOptions: POSTED_BY_OPTIONS,
        constructionStatusOptions: CONSTRUCTION_STATUS_OPTIONS,
        counts,
      }, 'Catalog retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CatalogController();
