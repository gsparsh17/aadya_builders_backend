const propertyService = require('./property.service');
const { successResponse, paginatedResponse, errorResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

/**
 * Property Controller - Handles HTTP requests for property operations
 */
class PropertyController {

  /**
   * Create new property
   * @route POST /api/v1/properties
   */
  async createProperty(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const property = await propertyService.createProperty(req.user.id, req.body);

      return successResponse(res, property, 'Property created successfully. It will be live after verification.', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all properties with filters
   * @route GET /api/v1/properties
   */
  async getProperties(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await propertyService.searchProperties(req.query, page, limit);

      return paginatedResponse(res, result.properties, page, limit, result.total, 'Properties retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get property by ID
   * @route GET /api/v1/properties/:id
   */
  async getPropertyById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const property = await propertyService.getPropertyById(id, userId);

      return successResponse(res, property, 'Property retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get property by code
   * @route GET /api/v1/properties/code/:code
   */
  async getPropertyByCode(req, res, next) {
    try {
      const { code } = req.params;
      const userId = req.user?.id;

      const property = await propertyService.getPropertyByCode(code, userId);

      return successResponse(res, property, 'Property retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update property
   * @route PUT /api/v1/properties/:id
   */
  async updateProperty(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { id } = req.params;

      const property = await propertyService.updateProperty(id, req.user.id, req.body, req.user.role);

      return successResponse(res, property, 'Property updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete property
   * @route DELETE /api/v1/properties/:id
   */
  async deleteProperty(req, res, next) {
    try {
      const { id } = req.params;

      await propertyService.deleteProperty(id, req.user.id, req.user.role);

      return successResponse(res, null, 'Property deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update property status
   * @route PATCH /api/v1/properties/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { id } = req.params;
      const { status } = req.body;

      const property = await propertyService.updatePropertyStatus(id, req.user.id, status, req.user.role);

      return successResponse(res, property, `Property marked as ${status}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's properties
   * @route GET /api/v1/properties/my-listings
   */
  async getMyProperties(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const { status, purpose } = req.query;

      const result = await propertyService.getUserProperties(req.user.id, { status, purpose }, page, limit);

      return paginatedResponse(res, result.properties, page, limit, result.total, 'Your properties retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get similar properties
   * @route GET /api/v1/properties/:id/similar
   */
  async getSimilarProperties(req, res, next) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 10;

      const properties = await propertyService.getSimilarProperties(id, limit);

      return successResponse(res, properties, 'Similar properties retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get nearby properties
   * @route GET /api/v1/properties/nearby
   */
  async getNearbyProperties(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { latitude, longitude, radius = 5, limit = 20 } = req.query;

      const properties = await propertyService.getNearbyProperties(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius),
        parseInt(limit)
      );

      return successResponse(res, properties, 'Nearby properties retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get featured properties
   * @route GET /api/v1/properties/featured
   */
  async getFeaturedProperties(req, res, next) {
    try {
      const { city, limit = 10 } = req.query;

      const properties = await propertyService.getFeaturedProperties(city, parseInt(limit));

      return successResponse(res, properties, 'Featured properties retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get price trends
   * @route GET /api/v1/properties/price-trends
   */
  async getPriceTrends(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }

      const { city, locality, propertyType } = req.query;

      if (!city) {
        throw new AppError('City is required', 400, 'CITY_REQUIRED');
      }

      const trends = await propertyService.getPriceTrends(city, locality, propertyType);

      return successResponse(res, trends, 'Price trends retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get property statistics
   * @route GET /api/v1/properties/stats
   */
  async getPropertyStats(req, res, next) {
    try {
      const stats = await propertyService.getPropertyStats();

      return successResponse(res, stats, 'Property statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  //   async uploadImages(req, res, next) {
  //   try {
  //     const { id } = req.params;

  //     const files = req.files || (req.file ? [req.file] : null);

  //     if (!files || files.length === 0) {
  //       throw new AppError('Please upload at least one image', 400, 'NO_IMAGES');
  //     }

  //     const images = files.map(file => {
  //       // Cloud storage typically provides location/url property
  //       let url = file.location || file.secure_url || file.url || file.path;

  //       if (!url && file.key && process.env.AWS_BUCKET_NAME) {
  //         url = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${file.key}`;
  //       }

  //       if (!url) {
  //         throw new AppError(`Could not determine image URL for ${file.originalname}`, 400, 'INVALID_UPLOAD');
  //       }

  //       return {
  //         url: url,
  //         caption: req.body.caption || '',
  //         isPrimary: false,
  //         order: 0
  //       };
  //     });

  //     const propertyImages = await propertyService.addPropertyImages(id, req.user.id, images);

  //     return successResponse(res, propertyImages, 'Images uploaded successfully');
  //   } catch (error) {
  //     console.error('Upload images error:', error);
  //     next(error);
  //   }
  // }

  /**
   * Upload property images
   * @route POST /api/v1/properties/:id/images
   */
  async uploadImages(req, res, next) {
    try {
      const { id } = req.params;

      // Get files from request
      const files = req.files || (req.file ? [req.file] : null);

      if (!files || files.length === 0) {
        throw new AppError('Please upload at least one image', 400, 'NO_IMAGES');
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const images = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let url = null;

        // Check if file was saved to disk (has path)
        if (file.path) {
          // File saved to disk - create URL from path
          let relativePath = file.path;

          // Convert Windows backslashes to forward slashes
          relativePath = relativePath.replace(/\\/g, '/');

          // Extract the part after 'uploads' or use relative path
          if (relativePath.includes('uploads')) {
            relativePath = relativePath.substring(relativePath.indexOf('uploads'));
          } else {
            // Just use the filename
            relativePath = `uploads/${file.filename}`;
          }

          url = `${baseUrl}/${relativePath}`;
        }
        // Check if file has filename but no path (memory storage)
        else if (file.filename) {
          url = `${baseUrl}/uploads/${file.filename}`;
        }
        // Check if it's a cloud storage URL
        else if (file.location) {
          url = file.location;
        }
        else if (file.secure_url) {
          url = file.secure_url;
        }
        else if (file.url) {
          url = file.url;
        }

        if (!url) {
          // For memory storage without disk save, we need to save the file manually
          console.log('File is in memory, need to save to disk');

          // Generate filename
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(file.originalname);
          const filename = `property-${uniqueSuffix}${ext}`;
          const uploadPath = path.join(__dirname, '../../uploads/properties', filename);

          // Ensure directory exists
          const uploadDir = path.join(__dirname, '../../uploads/properties');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          // Save buffer to disk
          fs.writeFileSync(uploadPath, file.buffer);

          // Create URL
          url = `${baseUrl}/uploads/properties/${filename}`;
        }

        if (!url) {
          throw new AppError(`Could not determine image URL for file: ${file.originalname}`, 400, 'INVALID_UPLOAD');
        }

        images.push({
          url: url,
          caption: req.body.caption || '',
          isPrimary: i === 0, // First image becomes primary
          order: i,
          uploadedAt: new Date()
        });
      }

      console.log('Uploaded images:', images.map(img => ({ url: img.url, isPrimary: img.isPrimary })));

      // Add images to property
      const propertyImages = await propertyService.addPropertyImages(id, req.user.id, images);

      return successResponse(res, propertyImages, `${images.length} image(s) uploaded successfully`);

    } catch (error) {
      console.error('Upload images error:', error);
      next(error);
    }
  }

  /**
   * Delete property image
   * @route DELETE /api/v1/properties/:id/images/:imageId
   */
  async deleteImage(req, res, next) {
    try {
      const { id, imageId } = req.params;

      const images = await propertyService.deletePropertyImage(id, imageId, req.user.id);

      return successResponse(res, images, 'Image deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set primary image
   * @route PUT /api/v1/properties/:id/images/:imageId/primary
   */
  async setPrimaryImage(req, res, next) {
    try {
      const { id, imageId } = req.params;

      const images = await propertyService.setPrimaryImage(id, imageId, req.user.id);

      return successResponse(res, images, 'Primary image set successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reorder property images
   * @route PUT /api/v1/properties/:id/images/reorder
   */
  async reorderImages(req, res, next) {
    try {
      const { id } = req.params;
      const { imageOrders } = req.body;

      if (!imageOrders || !Array.isArray(imageOrders)) {
        throw new AppError('imageOrders array is required', 400, 'INVALID_IMAGE_ORDERS');
      }

      const images = await propertyService.reorderImages(id, imageOrders, req.user.id);

      return successResponse(res, images, 'Images reordered successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get cities list
   * @route GET /api/v1/properties/cities
   */
  async getCities(req, res, next) {
    try {
      const cities = await propertyService.getCitiesList();

      return successResponse(res, cities, 'Cities retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get localities by city
   * @route GET /api/v1/properties/localities
   */
  async getLocalities(req, res, next) {
    try {
      const { city } = req.query;

      if (!city) {
        throw new AppError('City is required', 400, 'CITY_REQUIRED');
      }

      const localities = await propertyService.getLocalitiesByCity(city);

      return successResponse(res, localities, 'Localities retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== Admin Controllers ====================

  /**
   * Admin: Get all properties (including pending)
   * @route GET /api/v1/properties/admin/all
   */
  async adminGetAllProperties(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const { status, verified } = req.query;

      const Property = require('./property.model');

      const query = {};
      if (status) query.status = status;
      if (verified !== undefined) query.isVerified = verified === 'true';

      const [properties, total] = await Promise.all([
        Property.find(query)
          .populate('owner', 'name email phone')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Property.countDocuments(query)
      ]);

      return paginatedResponse(res, properties, page, limit, total, 'Properties retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Verify property
   * @route PUT /api/v1/properties/admin/:id/verify
   */
  async adminVerifyProperty(req, res, next) {
    try {
      const { id } = req.params;
      const { isVerified, rejectionReason } = req.body;

      const property = await propertyService.verifyProperty(id, req.user.id, isVerified, rejectionReason);

      return successResponse(res, property, `Property ${isVerified ? 'verified' : 'rejected'} successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Feature/unfeature property
   * @route PUT /api/v1/properties/admin/:id/feature
   */
  async adminToggleFeature(req, res, next) {
    try {
      const { id } = req.params;
      const { isFeatured, featuredUntil } = req.body;

      const property = await propertyService.toggleFeatureProperty(id, isFeatured, featuredUntil);

      return successResponse(res, property, `Property ${isFeatured ? 'featured' : 'unfeatured'} successfully`);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PropertyController();