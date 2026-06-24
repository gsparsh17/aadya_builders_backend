const Project = require('./project.model');
const Property = require('../properties/property.model');
const { successResponse, paginatedResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');
const notificationService = require('../notifications/notification.service');
const logger = require('../../utils/logger');

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
        { returnDocument: 'after' }
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
      
      // Trigger push notification asynchronously
      notificationService.sendListingAlert(project, 'project').catch(err => 
        logger.error('Failed to trigger project notification:', err)
      );

      return successResponse(res, project, 'Project created successfully', 201);
    } catch (error) { next(error); }
  }

  async update(req, res, next) {
    try {
      console.log('Project Update req.body:', JSON.stringify(req.body));
      const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, builder: req.user._id };
      const project = await Project.findOneAndUpdate(filter, req.body, { returnDocument: 'after', runValidators: true });
      console.log('Updated Project in DB:', JSON.stringify(project?.coordinates));
      if (!project) throw new AppError('Project not found or access denied', 404, 'PROJECT_NOT_FOUND');
      return successResponse(res, project, 'Project updated successfully');
    } catch (error) { next(error); }
  }

  async remove(req, res, next) {
    try {
      const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, builder: req.user._id };
      const project = await Project.findOneAndUpdate(filter, { status: 'inactive' }, { returnDocument: 'after' });
      if (!project) throw new AppError('Project not found or access denied', 404, 'PROJECT_NOT_FOUND');
      return successResponse(res, null, 'Project deleted successfully');
    } catch (error) { next(error); }
  }

  async uploadImages(req, res, next) {
    try {
      const { id } = req.params;
      const { uploadToCloudinary } = require('../../config/cloudinary');
      const files = req.files || (req.file ? [req.file] : null);

      if (!files || files.length === 0) {
        throw new AppError('Please upload at least one image', 400, 'NO_IMAGES');
      }

      const images = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await uploadToCloudinary(file.buffer, {
          folder: 'aadya/projects/images',
          resourceType: 'image'
        });

        images.push({
          url: result.secure_url,
          publicId: result.public_id,
          caption: req.body.caption || '',
          isPrimary: i === 0,
          order: i
        });
      }

      const filter = req.user.role === 'admin' ? { _id: id } : { _id: id, builder: req.user._id };
      const project = await Project.findOneAndUpdate(
        filter,
        { $push: { images: { $each: images } } },
        { returnDocument: 'after' }
      );
      
      if (!project) throw new AppError('Project not found or access denied', 404, 'PROJECT_NOT_FOUND');

      return successResponse(res, project.images, `${images.length} image(s) uploaded successfully`);
    } catch (error) { next(error); }
  }
}

module.exports = new ProjectController();
