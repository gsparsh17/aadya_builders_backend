const Property = require('./property.model');
const { successResponse } = require('../../utils/responseHandler');

const cityMatch = (city) => city ? { 'location.city': { $regex: `^${String(city).trim()}$`, $options: 'i' } } : {};
const active = (city) => ({ status: 'active', ...cityMatch(city) });

class PropertyStatsController {
  async byType(req, res, next) {
    try {
      const stats = await Property.aggregate([{ $match: active(req.query.city) }, { $group: { _id: '$propertyType', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
      return successResponse(res, stats.map(x => ({ type: x._id, label: String(x._id || '').replace(/_/g, ' '), count: x.count, icon: 'home' })), 'Property type stats retrieved successfully');
    } catch (error) { next(error); }
  }

  async byBhk(req, res, next) {
    try {
      const stats = await Property.aggregate([{ $match: active(req.query.city) }, { $group: { _id: '$bedrooms', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
      return successResponse(res, stats.filter(x => x._id !== null && x._id !== undefined).map(x => ({ bedrooms: x._id, bhk: x._id <= 1 ? '1 RK/1 BHK' : `${x._id} BHK`, count: x.count })), 'BHK stats retrieved successfully');
    } catch (error) { next(error); }
  }

  async byPostedBy(req, res, next) {
    try {
      const stats = await Property.aggregate([{ $match: active(req.query.city) }, { $group: { _id: '$ownerType', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
      return successResponse(res, stats.map(x => ({ postedBy: x._id, label: String(x._id || '').replace(/_/g, ' '), count: x.count })), 'Posted-by stats retrieved successfully');
    } catch (error) { next(error); }
  }
}

module.exports = new PropertyStatsController();
