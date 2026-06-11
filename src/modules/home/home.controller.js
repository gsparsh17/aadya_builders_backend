const Property = require('../properties/property.model');
const User = require('../users/user.model');
const Project = require('../projects/project.model');
const Article = require('../content/article.model');
const Notification = require('../notifications/notification.model');
const { successResponse } = require('../../utils/responseHandler');

const activeProperty = { status: 'active' };
const cityMatch = (city) => city ? { 'location.city': { $regex: `^${String(city).trim()}$`, $options: 'i' } } : {};
const projectCityMatch = (city) => city ? { city: { $regex: `^${String(city).trim()}$`, $options: 'i' } } : {};

const offerings = [
  { key: 'rent_home', title: 'Rent a home', subtitle: 'Apartments, builder floors, villas and more', image: '', deeplink: '/search?purpose=rent' },
  { key: 'pg_coliving', title: 'PG and co-living', subtitle: 'Organised, owner and broker listed PGs', image: '', deeplink: '/search?propertyType=pg,co_living' },
  { key: 'plots_land', title: 'Buy Plots/Land', subtitle: 'Residential Plots, Agricultural Farm lands, Inst. Lands and more', image: '', deeplink: '/search?propertyType=plot&purpose=land' },
  { key: 'commercial', title: 'Buy a commercial property', subtitle: 'Office spaces, shops and commercial listings', image: '', deeplink: '/search?category=commercial' }
];

const popularTools = [
  { key: 'eligibility', title: 'Check Eligibility', icon: 'check', endpoint: '/api/v1/insights/affordability' },
  { key: 'emi', title: 'EMI Calculator', icon: 'calculator', endpoint: '/api/v1/insights/emi-calculator' },
  { key: 'area', title: 'Area Converter', icon: 'area', endpoint: '/api/v1/insights/area-converter' },
  { key: 'stamp_duty', title: 'Stamp Duty', icon: 'document', endpoint: '/api/v1/insights/stamp-duty' }
];

class HomeController {
  async getHome(req, res, next) {
    try {
      const { city = 'Mumbai' } = req.query;
      const propertyFilter = { ...activeProperty, ...cityMatch(city) };
      const projectFilter = { status: { $in: ['upcoming', 'under_construction', 'ready_to_move', 'completed'] }, ...projectCityMatch(city) };

      const [
        unreadNotifications,
        recommendedProperties,
        recommendedProjects,
        localitiesYouMayLike,
        propertyTypeStats,
        bhkStats,
        postedByStats,
        popularBuildersRaw,
        topGainers,
        popularCities,
        articles
      ] = await Promise.all([
        req.user ? Notification.countDocuments({ recipient: req.user._id, read: false }) : Promise.resolve(0),
        Property.find(propertyFilter).populate('owner', 'name role isVerified').sort({ isFeatured: -1, rankingScore: -1, views: -1, createdAt: -1 }).limit(10),
        Project.find(projectFilter).populate('builder', 'name companyDetails.companyName companyDetails.companyLogo isVerified').sort({ isFeatured: -1, searches: -1, views: -1 }).limit(10),
        Property.aggregate([
          { $match: propertyFilter },
          { $group: { _id: { city: '$location.city', locality: '$location.locality' }, propertiesCount: { $sum: 1 }, avgPricePerSqft: { $avg: '$pricePerSqft' } } },
          { $sort: { propertiesCount: -1 } },
          { $limit: 10 }
        ]),
        Property.aggregate([{ $match: propertyFilter }, { $group: { _id: '$propertyType', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Property.aggregate([{ $match: propertyFilter }, { $group: { _id: '$bedrooms', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        Property.aggregate([{ $match: propertyFilter }, { $group: { _id: '$ownerType', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        User.find({ role: 'builder', isActive: true }).select('name companyDetails profilePicture isVerified').limit(10),
        Property.aggregate([
          { $match: propertyFilter },
          { $group: { _id: '$location.locality', avgPricePerSqft: { $avg: '$pricePerSqft' }, listingsCount: { $sum: 1 } } },
          { $sort: { avgPricePerSqft: -1, listingsCount: -1 } },
          { $limit: 10 }
        ]),
        Property.aggregate([
          { $match: activeProperty },
          { $group: { _id: '$location.city', propertyCount: { $sum: 1 } } },
          { $sort: { propertyCount: -1 } },
          { $limit: 10 }
        ]),
        Article.find({ status: 'published' }).sort({ publishedAt: -1, createdAt: -1 }).limit(5).catch(() => [])
      ]);

      const popularBuilders = await Promise.all(popularBuildersRaw.map(async (builder) => ({
        id: builder._id,
        name: builder.companyDetails?.companyName || builder.name,
        logo: builder.companyDetails?.companyLogo || builder.profilePicture,
        isVerified: builder.isVerified,
        totalProjects: await Project.countDocuments({ builder: builder._id, status: { $ne: 'inactive' } }),
        projectsInCity: await Project.countDocuments({ builder: builder._id, status: { $ne: 'inactive' }, ...projectCityMatch(city) })
      })));

      return successResponse(res, {
        location: city,
        unreadNotifications,
        recommendedProperties,
        recommendedProjects,
        localitiesYouMayLike: localitiesYouMayLike.map(x => ({ city: x._id.city, locality: x._id.locality, propertiesCount: x.propertiesCount, avgPricePerSqft: Math.round(x.avgPricePerSqft || 0) })),
        popularCities: popularCities.map(x => ({ name: x._id, propertyCount: x.propertyCount })),
        popularBuilders,
        topGainers: topGainers.map((x, index) => ({ rank: index + 1, locality: x._id, city, avgPricePerSqft: Math.round(x.avgPricePerSqft || 0), appreciationPercent: 0, listingsCount: x.listingsCount, period: '1Y' })),
        propertyTypeStats: propertyTypeStats.map(x => ({ type: x._id, label: String(x._id || '').replace(/_/g, ' '), count: x.count })),
        bhkStats: bhkStats.filter(x => x._id !== null && x._id !== undefined).map(x => ({ bhk: x._id <= 1 ? '1 RK/1 BHK' : `${x._id} BHK`, bedrooms: x._id, count: x.count })),
        postedByStats: postedByStats.map(x => ({ postedBy: x._id, label: String(x._id || '').replace(/_/g, ' '), count: x.count })),
        popularTools,
        articles,
        otherOfferings: offerings
      }, 'Home data retrieved successfully');
    } catch (error) { next(error); }
  }

  async getOfferings(req, res) { return successResponse(res, offerings, 'Offerings retrieved successfully'); }
}

module.exports = new HomeController();
