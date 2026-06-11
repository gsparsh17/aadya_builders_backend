const Property = require('../properties/property.model');
const { successResponse, paginatedResponse } = require('../../utils/responseHandler');

const cityRegex = (city) => ({ $regex: `^${String(city).trim()}$`, $options: 'i' });
const locRegex = (locality) => ({ $regex: `^${String(locality).trim()}$`, $options: 'i' });

class LocalityController {
  async getRecommended(req, res, next) {
    try {
      const { city, limit = 10 } = req.query;
      const match = { status: 'active' };
      if (city) match['location.city'] = cityRegex(city);
      const data = await Property.aggregate([
        { $match: match },
        { $group: {
          _id: { city: '$location.city', locality: '$location.locality' },
          propertiesCount: { $sum: 1 },
          avgPricePerSqft: { $avg: '$pricePerSqft' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        } },
        { $sort: { propertiesCount: -1, avgPricePerSqft: -1 } },
        { $limit: parseInt(limit) }
      ]);
      return successResponse(res, data.map(item => ({
        city: item._id.city,
        locality: item._id.locality,
        propertiesCount: item.propertiesCount,
        avgPricePerSqft: Math.round(item.avgPricePerSqft || 0),
        minPrice: item.minPrice || 0,
        maxPrice: item.maxPrice || 0
      })), 'Recommended localities retrieved successfully');
    } catch (error) { next(error); }
  }

  async getDetails(req, res, next) {
    try {
      const { city, locality } = req.params;
      const match = { status: 'active', 'location.city': cityRegex(city), 'location.locality': locRegex(locality) };
      const [stats] = await Property.aggregate([
        { $match: match },
        { $group: {
          _id: null,
          propertiesCount: { $sum: 1 },
          avgPricePerSqft: { $avg: '$pricePerSqft' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          buyCount: { $sum: { $cond: [{ $in: ['$purpose', ['buy', 'new_launch']] }, 1, 0] } },
          rentCount: { $sum: { $cond: [{ $in: ['$purpose', ['rent', 'commercial_lease']] }, 1, 0] } }
        } }
      ]);
      return successResponse(res, {
        city,
        locality,
        propertiesCount: stats?.propertiesCount || 0,
        avgPricePerSqft: Math.round(stats?.avgPricePerSqft || 0),
        minPrice: stats?.minPrice || 0,
        maxPrice: stats?.maxPrice || 0,
        buyCount: stats?.buyCount || 0,
        rentCount: stats?.rentCount || 0
      }, 'Locality details retrieved successfully');
    } catch (error) { next(error); }
  }

  async getProperties(req, res, next) {
    try {
      const { city, locality } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const filter = { status: 'active', 'location.city': cityRegex(city), 'location.locality': locRegex(locality) };
      const [properties, total] = await Promise.all([
        Property.find(filter).populate('owner', 'name role isVerified').skip(skip).limit(limit).sort({ isFeatured: -1, createdAt: -1 }),
        Property.countDocuments(filter)
      ]);
      return paginatedResponse(res, properties, page, limit, total, 'Locality properties retrieved successfully');
    } catch (error) { next(error); }
  }

  async getInsights(req, res, next) {
    try {
      const { city, locality } = req.params;
      const match = { status: 'active', 'location.city': cityRegex(city), 'location.locality': locRegex(locality) };
      const [overview, byType, byBhk] = await Promise.all([
        Property.aggregate([{ $match: match }, { $group: { _id: null, listingsCount: { $sum: 1 }, avgPricePerSqft: { $avg: '$pricePerSqft' }, avgPrice: { $avg: '$price' } } }]),
        Property.aggregate([{ $match: match }, { $group: { _id: '$propertyType', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } }, { $sort: { count: -1 } }]),
        Property.aggregate([{ $match: match }, { $group: { _id: '$bedrooms', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } }, { $sort: { _id: 1 } }])
      ]);
      return successResponse(res, {
        city,
        locality,
        overview: overview[0] || { listingsCount: 0, avgPricePerSqft: 0, avgPrice: 0 },
        byType,
        byBhk
      }, 'Locality insights retrieved successfully');
    } catch (error) { next(error); }
  }
}

module.exports = new LocalityController();
