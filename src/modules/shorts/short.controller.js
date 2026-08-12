const Short = require('./short.model');
const Property = require('../properties/property.model');
const { successResponse, paginatedResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');

class ShortController {
  async feed(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const filter = { status: 'active' };
      if (req.query.city) filter.city = { $regex: `^${String(req.query.city).trim()}$`, $options: 'i' };
      const [shorts, total] = await Promise.all([
        Short.find(filter).populate('property', 'title price propertyType bedrooms bathrooms area location images').populate('owner', 'name role isVerified').skip(skip).limit(limit).sort({ createdAt: -1 }),
        Short.countDocuments(filter)
      ]);
      return paginatedResponse(res, shorts, page, limit, total, 'Shorts feed retrieved successfully');
    } catch (error) { next(error); }
  }

  async getById(req, res, next) {
    try {
      const short = await Short.findById(req.params.id).populate('property').populate('owner', 'name role isVerified');
      if (!short) throw new AppError('Short not found', 404, 'SHORT_NOT_FOUND');
      return successResponse(res, short, 'Short retrieved successfully');
    } catch (error) { next(error); }
  }

  async create(req, res, next) {
    try {
      const { uploadToCloudinary } = require('../../config/cloudinary');
      
      const file = req.file;
      if (!file) {
        throw new AppError('Please upload a video file', 400, 'NO_VIDEO');
      }

      const property = await Property.findById(req.body.property);
      if (!property) throw new AppError('Linked property not found', 404, 'PROPERTY_NOT_FOUND');
      
      const result = await uploadToCloudinary(file.buffer, {
        folder: 'aadya/shorts/videos',
        resourceType: 'video'
      });

      const thumbnailUrl = result.secure_url.replace('/video/upload/', '/video/upload/w_400,h_600,c_fill,so_2/').replace(/\.[^.]+$/, '.jpg');

      const short = await Short.create({
        property: req.body.property,
        owner: req.user._id,
        videoUrl: result.secure_url,
        thumbnail: thumbnailUrl,
        caption: req.body.caption,
        city: property?.location?.city || req.body.city,
        locality: property?.location?.locality || req.body.locality
      });
      return successResponse(res, short, 'Short created successfully', 201);
    } catch (error) { next(error); }
  }

  async like(req, res, next) {
    try {
      const short = await Short.findByIdAndUpdate(req.params.id, { $addToSet: { likes: req.user._id } }, { returnDocument: 'after' });
      if (!short) throw new AppError('Short not found', 404, 'SHORT_NOT_FOUND');
      return successResponse(res, { liked: true, likesCount: short.likes.length }, 'Short liked successfully');
    } catch (error) { next(error); }
  }

  async unlike(req, res, next) {
    try {
      const short = await Short.findByIdAndUpdate(req.params.id, { $pull: { likes: req.user._id } }, { returnDocument: 'after' });
      if (!short) throw new AppError('Short not found', 404, 'SHORT_NOT_FOUND');
      return successResponse(res, { liked: false, likesCount: short.likes.length }, 'Short unliked successfully');
    } catch (error) { next(error); }
  }

  async view(req, res, next) {
    try {
      const short = await Short.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { returnDocument: 'after' });
      if (!short) throw new AppError('Short not found', 404, 'SHORT_NOT_FOUND');
      return successResponse(res, { views: short.views }, 'Short view recorded successfully');
    } catch (error) { next(error); }
  }

  async share(req, res, next) {
    try {
      const short = await Short.findByIdAndUpdate(req.params.id, { $inc: { shares: 1 } }, { returnDocument: 'after' });
      if (!short) throw new AppError('Short not found', 404, 'SHORT_NOT_FOUND');
      return successResponse(res, { shares: short.shares }, 'Short share recorded successfully');
    } catch (error) { next(error); }
  }

  async propertyShorts(req, res, next) {
    try {
      const shorts = await Short.find({ property: req.params.id, status: 'active' }).sort({ createdAt: -1 });
      return successResponse(res, shorts, 'Property shorts retrieved successfully');
    } catch (error) { next(error); }
  }

  async myShorts(req, res, next) {
    try {
      const shorts = await Short.find({ owner: req.user._id })
        .populate('property', 'title price location')
        .sort({ createdAt: -1 });
      return successResponse(res, shorts, 'My shorts retrieved successfully');
    } catch (error) { next(error); }
  }

  async update(req, res, next) {
    try {
      const short = await Short.findById(req.params.id);
      if (!short) throw new AppError('Short not found', 404, 'SHORT_NOT_FOUND');
      
      if (short.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      if (req.body.caption !== undefined) short.caption = req.body.caption;
      if (req.body.city !== undefined) short.city = req.body.city;
      if (req.body.locality !== undefined) short.locality = req.body.locality;
      if (req.body.status !== undefined) short.status = req.body.status;

      await short.save();
      return successResponse(res, short, 'Short updated successfully');
    } catch (error) { next(error); }
  }

  async remove(req, res, next) {
    try {
      const short = await Short.findById(req.params.id);
      if (!short) throw new AppError('Short not found', 404, 'SHORT_NOT_FOUND');

      if (short.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      await short.deleteOne();
      return successResponse(res, null, 'Short deleted successfully');
    } catch (error) { next(error); }
  }
}

module.exports = new ShortController();
