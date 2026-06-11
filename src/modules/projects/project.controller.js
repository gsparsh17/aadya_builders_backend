const Project = require('./project.model');
const Property = require('../properties/property.model');
const { successResponse, paginatedResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');

const cityMatch = (city) => city ? { city: { $regex: `^${String(city).trim()}$`, $options: 'i' } } : {};
const activeProjectMatch = { status: { $in: ['upcoming', 'under_construction', 'ready_to_move', 'completed'] } };

class ProjectController {
  async getRecommended(req, res, next) {
    try {
      const { city, limit = 10 } = req.query;
      const projects = await Project.find({ ...activeProjectMatch, ...cityMatch(city) })
        .populate('builder', 'name companyDetails.companyName companyDetails.companyLogo isVerified')
        .sort({ isFeatured: -1, searches: -1, views: -1, createdAt: -1 })
        .limit(parseInt(limit));
      return successResponse(res, projects, 'Recommended projects retrieved successfully');
    } catch (error) { next(error); }
  }

  async getPopular(req, res, next) {
    try {
      const { city, limit = 10 } = req.query;
      const projects = await Project.find({ ...activeProjectMatch, ...cityMatch(city) })
        .populate('builder', 'name companyDetails.companyName companyDetails.companyLogo isVerified')
        .sort({ searches: -1, views: -1, isFeatured: -1 })
        .limit(parseInt(limit));
      return successResponse(res, projects, 'Popular projects retrieved successfully');
    } catch (error) { next(error); }
  }

  async search(req, res, next) {
    try {
      const { q = '', city, limit = 10 } = req.query;
      const filter = { ...activeProjectMatch, ...cityMatch(city) };
      if (q) filter.name = { $regex: String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      const projects = await Project.find(filter)
        .select('name city locality images priceRange configurations status builder')
        .populate('builder', 'name companyDetails.companyName')
        .limit(parseInt(limit));
      return successResponse(res, projects, 'Projects search results retrieved successfully');
    } catch (error) { next(error); }
  }

  async getById(req, res, next) {
    try {
      const project = await Project.findByIdAndUpdate(
        req.params.id,
        { $inc: { views: 1 } },
        { new: true }
      ).populate('builder', 'name email phone role companyDetails reraDetails isVerified profilePicture');
      if (!project) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
      return successResponse(res, project, 'Project retrieved successfully');
    } catch (error) { next(error); }
  }

  async getProjectProperties(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const filter = { project: req.params.id, status: 'active' };
      const [properties, total] = await Promise.all([
        Property.find(filter).populate('owner', 'name role isVerified').skip(skip).limit(limit).sort({ isFeatured: -1, createdAt: -1 }),
        Property.countDocuments(filter)
      ]);
      return paginatedResponse(res, properties, page, limit, total, 'Project properties retrieved successfully');
    } catch (error) { next(error); }
  }

  async create(req, res, next) {
    try {
      const project = await Project.create({ ...req.body, builder: req.body.builder || req.user._id });
      return successResponse(res, project, 'Project created successfully', 201);
    } catch (error) { next(error); }
  }

  async update(req, res, next) {
    try {
      const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, builder: req.user._id };
      const project = await Project.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });
      if (!project) throw new AppError('Project not found or access denied', 404, 'PROJECT_NOT_FOUND');
      return successResponse(res, project, 'Project updated successfully');
    } catch (error) { next(error); }
  }

  async remove(req, res, next) {
    try {
      const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, builder: req.user._id };
      const project = await Project.findOneAndUpdate(filter, { status: 'inactive' }, { new: true });
      if (!project) throw new AppError('Project not found or access denied', 404, 'PROJECT_NOT_FOUND');
      return successResponse(res, null, 'Project deleted successfully');
    } catch (error) { next(error); }
  }
}

module.exports = new ProjectController();
