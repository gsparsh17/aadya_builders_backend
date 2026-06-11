const Property = require('../properties/property.model');
const { successResponse } = require('../../utils/responseHandler');

const imageMap = {
  mumbai: 'https://images.unsplash.com/photo-1566552881560-0be862a7c445',
  delhi: 'https://images.unsplash.com/photo-1587474260584-136574528ed5',
  kolkata: 'https://images.unsplash.com/photo-1558431382-27e303142255',
  chennai: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220',
  bengaluru: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2',
  pune: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
  hyderabad: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f',
  ahmedabad: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d'
};

class LocationController {
  async getPopularCities(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const cities = await Property.aggregate([
        { $match: { status: 'active' } },
        { $group: {
          _id: '$location.city',
          propertyCount: { $sum: 1 },
          buyCount: { $sum: { $cond: [{ $in: ['$purpose', ['buy', 'new_launch']] }, 1, 0] } },
          rentCount: { $sum: { $cond: [{ $in: ['$purpose', ['rent', 'commercial_lease']] }, 1, 0] } },
          averagePrice: { $avg: '$pricePerSqft' }
        } },
        { $sort: { propertyCount: -1 } },
        { $limit: limit }
      ]);
      const data = cities.filter(c => c._id).map(c => ({
        name: c._id,
        image: imageMap[String(c._id).toLowerCase()] || imageMap.pune,
        propertyCount: c.propertyCount,
        buyCount: c.buyCount,
        rentCount: c.rentCount,
        averagePrice: Math.round(c.averagePrice || 0)
      }));
      return successResponse(res, data, 'Popular cities retrieved successfully');
    } catch (error) { next(error); }
  }

  async getCityDetails(req, res, next) {
    try {
      const city = req.params.city;
      const [stats] = await Property.aggregate([
        { $match: { status: 'active', 'location.city': { $regex: `^${city}$`, $options: 'i' } } },
        { $group: { _id: '$location.city', propertyCount: { $sum: 1 }, averagePrice: { $avg: '$pricePerSqft' }, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' } } }
      ]);
      return successResponse(res, {
        name: stats?._id || city,
        image: imageMap[String(city).toLowerCase()] || imageMap.pune,
        propertyCount: stats?.propertyCount || 0,
        averagePrice: Math.round(stats?.averagePrice || 0),
        minPrice: stats?.minPrice || 0,
        maxPrice: stats?.maxPrice || 0
      }, 'City details retrieved successfully');
    } catch (error) { next(error); }
  }
}

module.exports = new LocationController();
