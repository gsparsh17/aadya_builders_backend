const User = require('../users/user.model');
const Property = require('../properties/property.model');
const Project = require('../projects/project.model');
const { successResponse, paginatedResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');

const cityFilter = (city) => city ? { 'location.city': { $regex: `^${String(city).trim()}$`, $options: 'i' } } : {};

class BuilderController {
  async getPopular(req, res, next) {
    try {
      const { city, limit = 10 } = req.query;
      const projectCityFilter = city ? { city: { $regex: `^${String(city).trim()}$`, $options: 'i' } } : {};
      const builders = await User.find({ role: 'builder', isActive: true })
        .select('name email phone profilePicture companyDetails reraDetails isVerified createdAt')
        .limit(100);

      const data = await Promise.all(builders.map(async (builder) => {
        const [totalProjects, projectsInCity, totalProperties, propertiesInCity] = await Promise.all([
          Project.countDocuments({ builder: builder._id, status: { $ne: 'inactive' } }),
          Project.countDocuments({ builder: builder._id, status: { $ne: 'inactive' }, ...projectCityFilter }),
          Property.countDocuments({ owner: builder._id, status: 'active' }),
          Property.countDocuments({ owner: builder._id, status: 'active', ...cityFilter(city) })
        ]);
        return {
          id: builder._id,
          name: builder.companyDetails?.companyName || builder.name,
          contactName: builder.name,
          logo: builder.companyDetails?.companyLogo || builder.profilePicture,
          isVerified: builder.isVerified,
          totalProjects,
          projectsInCity,
          totalProperties,
          propertiesInCity
        };
      }));

      data.sort((a, b) => (b.projectsInCity + b.propertiesInCity) - (a.projectsInCity + a.propertiesInCity));
      return successResponse(res, data.slice(0, parseInt(limit)), 'Popular builders retrieved successfully');
    } catch (error) { next(error); }
  }

  async getById(req, res, next) {
    try {
      const builder = await User.findOne({ _id: req.params.id, isActive: true })
        .select('name email phone role profilePicture companyDetails reraDetails isVerified createdAt');
      if (!builder) throw new AppError('Builder not found', 404, 'BUILDER_NOT_FOUND');
      const [totalProjects, totalProperties] = await Promise.all([
        Project.countDocuments({ builder: builder._id, status: { $ne: 'inactive' } }),
        Property.countDocuments({ owner: builder._id, status: 'active' })
      ]);
      return successResponse(res, { builder, stats: { totalProjects, totalProperties } }, 'Builder retrieved successfully');
    } catch (error) { next(error); }
  }

  async getProjects(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const filter = { builder: req.params.id, status: { $ne: 'inactive' } };
      const [projects, total] = await Promise.all([
        Project.find(filter).skip(skip).limit(limit).sort({ isFeatured: -1, createdAt: -1 }),
        Project.countDocuments(filter)
      ]);
      return paginatedResponse(res, projects, page, limit, total, 'Builder projects retrieved successfully');
    } catch (error) { next(error); }
  }

  async getProperties(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const filter = { owner: req.params.id, status: 'active' };
      const [properties, total] = await Promise.all([
        Property.find(filter).skip(skip).limit(limit).sort({ isFeatured: -1, createdAt: -1 }),
        Property.countDocuments(filter)
      ]);
      return paginatedResponse(res, properties, page, limit, total, 'Builder properties retrieved successfully');
    } catch (error) { next(error); }
  }
}

module.exports = new BuilderController();
