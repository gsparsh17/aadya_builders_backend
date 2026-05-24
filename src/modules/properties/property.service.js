const Property = require('./property.model');
const User = require('../users/user.model');
const Lead = require('../leads/lead.model');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const { clearCache } = require('../../config/redis');
const { deleteFromCloudinary, deleteMultipleFromCloudinary } = require('../../config/cloudinary');
const emailService = require('../../utils/emailService');
const smsService = require('../../utils/smsService');
const axios = require('axios');

/**
 * Property Service - Handles all business logic for property operations
 */
class PropertyService {

  /**
   * Generate unique property code
   */
  generatePropertyCode(purpose, propertyType) {
    const prefix = purpose.substring(0, 1).toUpperCase();
    const typePrefix = propertyType.substring(0, 2).toUpperCase();
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${typePrefix}${timestamp}${random}`;
  }

  /**
   * Geocode address to coordinates
   */
  /**
   * Geocode address to coordinates
   */
  async geocodeAddress(address, city, state) {
    try {
      const fullAddress = `${address}, ${city}, ${state}, India`;
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: fullAddress,
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });

      if (response.data.results && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        // Return as GeoJSON Point format
        return {
          type: 'Point',
          coordinates: [location.lng, location.lat]
        };
      }

      // Return default coordinates for the city if geocoding fails
      const defaultCoords = this.getDefaultCityCoordinates(city);
      return {
        type: 'Point',
        coordinates: defaultCoords
      };
    } catch (error) {
      logger.error('Geocoding error:', error);
      const defaultCoords = this.getDefaultCityCoordinates(city);
      return {
        type: 'Point',
        coordinates: defaultCoords
      };
    }
  }

  /**
   * Get default coordinates for major cities
   */
  getDefaultCityCoordinates(city) {
    const cityCoordinates = {
      'mumbai': [72.8777, 19.0760],
      'delhi': [77.2090, 28.6139],
      'bangalore': [77.5946, 12.9716],
      'hyderabad': [78.4867, 17.3850],
      'chennai': [80.2707, 13.0827],
      'kolkata': [88.3639, 22.5726],
      'pune': [73.8567, 18.5204],
      'ahmedabad': [72.5714, 23.0225],
      'jaipur': [75.7873, 26.9124],
      'lucknow': [80.9462, 26.8467]
    };

    const normalizedCity = city.toLowerCase();
    return cityCoordinates[normalizedCity] || [78.9629, 20.5937]; // Default to center of India
  }

  /**
   * Create new property
   */
  async createProperty(userId, propertyData) {
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if user can post property
    if (!user.canPostProperty()) {
      throw new AppError('You have reached your listing limit. Please upgrade your plan.', 403, 'LISTING_LIMIT_REACHED');
    }

    // Geocode address if coordinates not provided
    if (!propertyData.location?.coordinates) {
      const geoCoordinates = await this.geocodeAddress(
        propertyData.location.address,
        propertyData.location.city,
        propertyData.location.state
      );
      propertyData.location.coordinates = geoCoordinates;
    }

    // Generate property code
    const propertyCode = this.generatePropertyCode(
      propertyData.purpose,
      propertyData.propertyType
    );

    // Create property
    const property = await Property.create({
      ...propertyData,
      propertyCode,
      owner: userId,
      ownerType: user.role === 'dealer' ? 'dealer' : user.role === 'builder' ? 'builder' : 'individual',
      status: 'pending'
    });

    // Update user's listing count
    if (user.subscription) {
      user.subscription.listingsPosted = (user.subscription.listingsPosted || 0) + 1;
      user.subscription.listingsRemaining = Math.max(0, (user.subscription.listingsRemaining || 0) - 1);
      await user.save();
    }

    // Clear search cache
    await clearCache('search:*');

    // Send notification email
    emailService.sendPropertyCreatedEmail(user.email, user.name, property.title, property.propertyCode)
      .catch(err => logger.error('Failed to send property created email:', err));

    return property;
  }

  /**
   * Get property by ID
   */
  async getPropertyById(propertyId, userId = null) {
    const property = await Property.findById(propertyId)
      .populate('owner', 'name email phone profilePicture role isVerified companyDetails');
    // .populate('project', 'name builder totalUnits possessionDate');

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    // Increment view count (async, don't wait)
    this.incrementPropertyViews(propertyId, userId).catch(err =>
      logger.error('Failed to increment views:', err)
    );

    // Add isSaved flag if user is authenticated
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        const isSaved = user.savedProperties.some(id => id.toString() === propertyId);
        property._doc.isSaved = isSaved;
      }
    }

    return property;
  }

  /**
   * Get property by code
   */
  async getPropertyByCode(propertyCode, userId = null) {
    const property = await Property.findOne({ propertyCode })
      .populate('owner', 'name email phone profilePicture role isVerified companyDetails');

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    // Increment view count
    this.incrementPropertyViews(property._id, userId).catch(err =>
      logger.error('Failed to increment views:', err)
    );

    return property;
  }

  /**
   * Increment property views
   */
  async incrementPropertyViews(propertyId, userId = null) {
    const update = { $inc: { views: 1 } };

    // Track unique views (simplified - in production use Redis for better accuracy)
    if (userId) {
      // Check if user has viewed this property recently
      const PropertyView = require('./property.model'); // Would need a separate view tracking model
    }

    await Property.findByIdAndUpdate(propertyId, update);
  }

  /**
   * Update property
   */
  async updateProperty(propertyId, userId, updateData, userRole) {
    const property = await Property.findById(propertyId);

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    // Check ownership (unless admin)
    if (userRole !== 'admin' && property.owner.toString() !== userId) {
      throw new AppError('You do not have permission to update this property', 403, 'FORBIDDEN');
    }

    // Fields that cannot be updated
    const restrictedFields = ['propertyCode', 'owner', 'ownerType', 'isVerified', 'views', 'leads', 'rankingScore'];
    restrictedFields.forEach(field => delete updateData[field]);

    // If address changed, re-geocode
    if (updateData.location && (updateData.location.address || updateData.location.city)) {
      const geoCoordinates = await this.geocodeAddress(
        updateData.location.address || property.location.address,
        updateData.location.city || property.location.city,
        updateData.location.state || property.location.state
      );
      updateData.location.coordinates = geoCoordinates;
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      propertyId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Clear cache
    await clearCache(`property:${propertyId}*`);
    await clearCache('search:*');

    return updatedProperty;
  }

  /**
   * Delete property
   */
  async deleteProperty(propertyId, userId, userRole) {
    const property = await Property.findById(propertyId);

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    // Check ownership (unless admin)
    if (userRole !== 'admin' && property.owner.toString() !== userId) {
      throw new AppError('You do not have permission to delete this property', 403, 'FORBIDDEN');
    }

    // Delete associated images from Cloudinary
    if (property.images && property.images.length > 0) {
      const imagePublicIds = property.images
        .map(img => img.publicId)
        .filter(Boolean);
      if (imagePublicIds.length > 0) {
        deleteMultipleFromCloudinary(imagePublicIds, 'image').catch(err =>
          logger.error('Failed to delete images from Cloudinary:', err)
        );
      }
    }

    // Delete associated videos from Cloudinary
    if (property.videos && property.videos.length > 0) {
      const videoPublicIds = property.videos
        .map(vid => vid.publicId)
        .filter(Boolean);
      if (videoPublicIds.length > 0) {
        deleteMultipleFromCloudinary(videoPublicIds, 'video').catch(err =>
          logger.error('Failed to delete videos from Cloudinary:', err)
        );
      }
    }

    await Property.findByIdAndDelete(propertyId);

    // Delete associated leads
    await Lead.deleteMany({ property: propertyId });

    // Clear cache
    await clearCache(`property:${propertyId}*`);
    await clearCache('search:*');

    return true;
  }

  /**
   * Update property status
   */
  async updatePropertyStatus(propertyId, userId, status, userRole) {
    const property = await Property.findById(propertyId);

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (userRole !== 'admin' && property.owner.toString() !== userId) {
      throw new AppError('You do not have permission to update this property', 403, 'FORBIDDEN');
    }

    property.status = status;

    if (status === 'sold' || status === 'rented') {
      property.soldAt = new Date();
    }

    await property.save();

    // Clear cache
    await clearCache(`property:${propertyId}*`);
    await clearCache('search:*');

    return property;
  }

  /**
   * Search properties with filters
   */
  async searchProperties(filters, page = 1, limit = 20) {
    const query = { status: 'active' };

    // Purpose filter
    if (filters.purpose) {
      query.purpose = filters.purpose;
    }

    // Property type filter
    if (filters.propertyType) {
      const types = filters.propertyType.split(',').map(t => t.trim());
      query.propertyType = { $in: types };
    }

    // City filter
    if (filters.city) {
      query['location.city'] = { $regex: filters.city, $options: 'i' };
    }

    // Locality filter
    if (filters.locality) {
      query['location.locality'] = { $regex: filters.locality, $options: 'i' };
    }

    // Price range filter
    if (filters.minPrice || filters.maxPrice) {
      query.price = {};
      if (filters.minPrice) query.price.$gte = parseFloat(filters.minPrice);
      if (filters.maxPrice) query.price.$lte = parseFloat(filters.maxPrice);
    }

    // Area range filter
    if (filters.minArea || filters.maxArea) {
      query['area.value'] = {};
      if (filters.minArea) query['area.value'].$gte = parseFloat(filters.minArea);
      if (filters.maxArea) query['area.value'].$lte = parseFloat(filters.maxArea);
    }

    // BHK filter
    if (filters.bhk) {
      const bhkValues = filters.bhk.split(',').map(b => {
        if (b === '4+') return { $gte: 4 };
        return parseInt(b);
      });

      if (bhkValues.some(v => typeof v === 'object')) {
        query.$or = bhkValues.map(v => {
          if (typeof v === 'object') return { bedrooms: v };
          return { bedrooms: v };
        });
      } else {
        query.bedrooms = { $in: bhkValues };
      }
    }

    // Furnishing filter
    if (filters.furnishing) {
      query.furnishing = filters.furnishing;
    }

    // Amenities filter
    if (filters.amenities) {
      const amenities = filters.amenities.split(',').map(a => a.trim());
      query.amenities = { $all: amenities };
    }

    // Posted by filter
    if (filters.postedBy) {
      query.ownerType = filters.postedBy;
    }

    // Verification filter
    if (filters.verified === 'true') {
      query.isVerified = true;
    }

    // Featured filter
    if (filters.featured === 'true') {
      query.isFeatured = true;
    }

    // Geospatial search
    if (filters.latitude && filters.longitude && filters.radius) {
      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(filters.longitude), parseFloat(filters.latitude)]
          },
          $maxDistance: parseFloat(filters.radius) * 1000 // Convert km to meters
        }
      };
    }

    // Determine sort order
    let sortOptions = {};
    switch (filters.sort) {
      case 'price_asc':
        sortOptions = { price: 1 };
        break;
      case 'price_desc':
        sortOptions = { price: -1 };
        break;
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'relevance':
      default:
        sortOptions = { rankingScore: -1, createdAt: -1 };
        break;
    }

    // Execute query
    const skip = (page - 1) * limit;

    const [properties, total] = await Promise.all([
      Property.find(query)
        .populate('owner', 'name profilePicture role isVerified')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Property.countDocuments(query)
    ]);

    return {
      properties,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get user's properties
   */
  async getUserProperties(userId, filters = {}, page = 1, limit = 20) {
    const query = { owner: userId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.purpose) {
      query.purpose = filters.purpose;
    }

    const skip = (page - 1) * limit;

    const [properties, total] = await Promise.all([
      Property.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Property.countDocuments(query)
    ]);

    return {
      properties,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get similar properties
   */
  async getSimilarProperties(propertyId, limit = 10) {
    const property = await Property.findById(propertyId);

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    const query = {
      _id: { $ne: propertyId },
      status: 'active',
      purpose: property.purpose,
      'location.city': property.location.city,
      propertyType: property.propertyType
    };

    // Price range: ±30%
    const priceRange = property.price * 0.3;
    query.price = {
      $gte: property.price - priceRange,
      $lte: property.price + priceRange
    };

    const similarProperties = await Property.find(query)
      .populate('owner', 'name profilePicture')
      .sort({ rankingScore: -1 })
      .limit(limit);

    return similarProperties;
  }

  /**
   * Get nearby properties
   */
  async getNearbyProperties(latitude, longitude, radius = 5, limit = 20) {
    const properties = await Property.find({
      status: 'active',
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radius * 1000
        }
      }
    })
      .populate('owner', 'name profilePicture')
      .limit(limit);

    return properties;
  }

  /**
   * Get featured properties
   */
  async getFeaturedProperties(city = null, limit = 10) {
    const query = {
      status: 'active',
      isFeatured: true,
      featuredUntil: { $gt: new Date() }
    };

    if (city) {
      query['location.city'] = { $regex: city, $options: 'i' };
    }

    const properties = await Property.find(query)
      .populate('owner', 'name profilePicture')
      .sort({ rankingScore: -1 })
      .limit(limit);

    return properties;
  }

  /**
   * Get price trends for a locality
   */
  async getPriceTrends(city, locality = null, propertyType = null) {
    const matchStage = {
      status: 'active',
      'location.city': { $regex: city, $options: 'i' }
    };

    if (locality) {
      matchStage['location.locality'] = { $regex: locality, $options: 'i' };
    }

    if (propertyType) {
      matchStage.propertyType = propertyType;
    }

    const trends = await Property.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            purpose: '$purpose',
            propertyType: '$propertyType',
            locality: '$location.locality'
          },
          avgPrice: { $avg: '$price' },
          avgPricePerSqft: { $avg: '$pricePerSqft' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return trends;
  }

  /**
   * Get property statistics
   */
  async getPropertyStats() {
    const stats = await Property.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          totalProperties: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          totalViews: { $sum: '$views' },
          totalLeads: { $sum: '$leads' }
        }
      }
    ]);

    const byCity = await Property.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$location.city',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const byPurpose = await Property.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$purpose',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      overview: stats[0] || { totalProperties: 0, avgPrice: 0, totalViews: 0, totalLeads: 0 },
      byCity,
      byPurpose
    };
  }

  /**
   * Add images to property
   */
  async addPropertyImages(propertyId, userId, images) {
    try {
      // First verify ownership
      const property = await Property.findById(propertyId).select('owner images');

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      if (property.owner.toString() !== userId) {
        throw new AppError('You do not have permission to modify this property', 403, 'FORBIDDEN');
      }

      // Check image limit
      const currentImageCount = property.images?.length || 0;
      if (currentImageCount + images.length > 20) {
        throw new AppError('Maximum 20 images allowed per property', 400, 'IMAGE_LIMIT_EXCEEDED');
      }

      // Prepare new images
      const newImages = images.map((img, index) => ({
        url: img.url,
        publicId: img.publicId || null,
        caption: img.caption || '',
        isPrimary: currentImageCount === 0 && index === 0,
        order: currentImageCount + index,
        uploadedAt: new Date()
      }));

      // Use updateOne with $push to avoid pre-save hooks
      const result = await Property.updateOne(
        { _id: propertyId },
        { $push: { images: { $each: newImages } } }
      );

      if (result.modifiedCount === 0) {
        throw new AppError('Failed to add images', 500, 'UPDATE_FAILED');
      }

      // Fetch updated property to return images
      const updatedProperty = await Property.findById(propertyId).select('images');
      return updatedProperty.images;

    } catch (error) {
      console.error('Error in addPropertyImages:', error);

      if (error.isOperational) {
        throw error;
      }

      throw new AppError('Failed to save images. Please try again.', 500, 'SAVE_FAILED');
    }
  }

  /**
   * Delete property image
   */
  async deletePropertyImage(propertyId, imageId, userId) {
    const property = await Property.findById(propertyId);

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (property.owner.toString() !== userId) {
      throw new AppError('You do not have permission to modify this property', 403, 'FORBIDDEN');
    }

    const imageIndex = property.images.findIndex(img => img._id.toString() === imageId);

    if (imageIndex === -1) {
      throw new AppError('Image not found', 404, 'IMAGE_NOT_FOUND');
    }

    const wasPrimary = property.images[imageIndex].isPrimary;
    const deletedImage = property.images[imageIndex];

    // Delete from Cloudinary if publicId exists
    if (deletedImage.publicId) {
      deleteFromCloudinary(deletedImage.publicId, 'image').catch(err =>
        logger.error('Failed to delete image from Cloudinary:', err)
      );
    }

    // Remove image
    property.images.splice(imageIndex, 1);

    // If primary was removed, set new primary
    if (wasPrimary && property.images.length > 0) {
      property.images[0].isPrimary = true;
    }

    // Reorder remaining images
    property.images.forEach((img, index) => {
      img.order = index;
    });

    await property.save();

    return property.images;
  }

  /**
   * Set primary image
   */
  async setPrimaryImage(propertyId, imageId, userId) {
    const property = await Property.findById(propertyId);

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (property.owner.toString() !== userId) {
      throw new AppError('You do not have permission to modify this property', 403, 'FORBIDDEN');
    }

    // Reset all primary flags
    property.images.forEach(img => {
      img.isPrimary = false;
    });

    // Set new primary
    const targetImage = property.images.find(img => img._id.toString() === imageId);
    if (!targetImage) {
      throw new AppError('Image not found', 404, 'IMAGE_NOT_FOUND');
    }

    targetImage.isPrimary = true;
    await property.save();

    return property.images;
  }

  /**
   * Reorder property images
   */
  async reorderImages(propertyId, imageOrders, userId) {
    const property = await Property.findById(propertyId);

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (property.owner.toString() !== userId) {
      throw new AppError('You do not have permission to modify this property', 403, 'FORBIDDEN');
    }

    // Update order for each image
    imageOrders.forEach(({ imageId, order }) => {
      const image = property.images.find(img => img._id.toString() === imageId);
      if (image) {
        image.order = order;
      }
    });

    // Sort images by order
    property.images.sort((a, b) => a.order - b.order);

    await property.save();

    return property.images;
  }

  /**
   * Add videos to property
   */
  async addPropertyVideos(propertyId, userId, videos) {
    try {
      const property = await Property.findById(propertyId).select('owner videos');

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      if (property.owner.toString() !== userId) {
        throw new AppError('You do not have permission to modify this property', 403, 'FORBIDDEN');
      }

      // Check video limit
      const currentVideoCount = property.videos?.length || 0;
      if (currentVideoCount + videos.length > 5) {
        throw new AppError('Maximum 5 videos allowed per property', 400, 'VIDEO_LIMIT_EXCEEDED');
      }

      // Prepare new videos
      const newVideos = videos.map((vid, index) => ({
        url: vid.url,
        publicId: vid.publicId || null,
        caption: vid.caption || '',
        duration: vid.duration || null,
        thumbnail: vid.thumbnail || null,
        order: currentVideoCount + index,
        uploadedAt: new Date()
      }));

      // Use updateOne with $push to avoid pre-save hooks
      const result = await Property.updateOne(
        { _id: propertyId },
        { $push: { videos: { $each: newVideos } } }
      );

      if (result.modifiedCount === 0) {
        throw new AppError('Failed to add videos', 500, 'UPDATE_FAILED');
      }

      // Fetch updated property to return videos
      const updatedProperty = await Property.findById(propertyId).select('videos');
      return updatedProperty.videos;

    } catch (error) {
      logger.error('Error in addPropertyVideos:', error);

      if (error.isOperational) {
        throw error;
      }

      throw new AppError('Failed to save videos. Please try again.', 500, 'SAVE_FAILED');
    }
  }

  /**
   * Delete property video
   */
  async deletePropertyVideo(propertyId, videoId, userId) {
    const property = await Property.findById(propertyId);

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (property.owner.toString() !== userId) {
      throw new AppError('You do not have permission to modify this property', 403, 'FORBIDDEN');
    }

    const videoIndex = property.videos.findIndex(vid => vid._id.toString() === videoId);

    if (videoIndex === -1) {
      throw new AppError('Video not found', 404, 'VIDEO_NOT_FOUND');
    }

    const deletedVideo = property.videos[videoIndex];

    // Delete from Cloudinary if publicId exists
    if (deletedVideo.publicId) {
      deleteFromCloudinary(deletedVideo.publicId, 'video').catch(err =>
        logger.error('Failed to delete video from Cloudinary:', err)
      );
    }

    // Remove video
    property.videos.splice(videoIndex, 1);

    // Reorder remaining videos
    property.videos.forEach((vid, index) => {
      vid.order = index;
    });

    await property.save();

    return property.videos;
  }

  /**
   * Admin: Verify property
   */
  async verifyProperty(propertyId, adminId, isVerified, rejectionReason = null) {
    const property = await Property.findById(propertyId);

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    property.isVerified = isVerified;
    property.verifiedBy = adminId;
    property.verificationDate = new Date();

    if (!isVerified) {
      property.status = 'rejected';
      property.rejectionReason = rejectionReason || 'Does not meet verification criteria';
    } else {
      property.status = 'active';
    }

    await property.save();

    // Notify owner
    const User = require('../users/user.model');
    const owner = await User.findById(property.owner);
    if (owner) {
      const subject = isVerified ? 'Your property has been verified' : 'Property verification failed';
      const message = isVerified
        ? `Congratulations! Your property "${property.title}" has been verified and is now live.`
        : `Your property "${property.title}" could not be verified. Reason: ${property.rejectionReason}`;

      emailService.sendEmail(owner.email, subject, message).catch(err =>
        logger.error('Failed to send verification email:', err)
      );
    }

    return property;
  }

  /**
   * Admin: Feature/unfeature property
   */
  async toggleFeatureProperty(propertyId, isFeatured, featuredUntil = null) {
    const property = await Property.findById(propertyId);

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    property.isFeatured = isFeatured;
    property.featuredUntil = isFeatured ? (featuredUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) : null;

    await property.save();

    return property;
  }

  /**
   * Get cities list with property count
   */
  async getCitiesList() {
    const cities = await Property.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$location.city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ]);

    return cities.map(c => ({ name: c._id, count: c.count }));
  }

  /**
   * Get localities by city
   */
  async getLocalitiesByCity(city) {
    const localities = await Property.aggregate([
      {
        $match: {
          status: 'active',
          'location.city': { $regex: city, $options: 'i' }
        }
      },
      {
        $group: {
          _id: '$location.locality',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 100 }
    ]);

    return localities.map(l => ({ name: l._id, count: l.count }));
  }
}

module.exports = new PropertyService();