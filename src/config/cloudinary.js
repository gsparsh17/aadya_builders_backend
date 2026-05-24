const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {Object} options - Upload options
 * @param {string} options.folder - Cloudinary folder path (e.g., 'aadya/properties/images')
 * @param {string} options.resourceType - 'image' | 'video' | 'raw' | 'auto'
 * @param {string} [options.publicId] - Custom public ID (auto-generated if omitted)
 * @param {Object} [options.transformation] - Cloudinary transformations to apply
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      folder = 'aadya/properties',
      resourceType = 'auto',
      publicId,
      transformation
    } = options;

    const uploadOptions = {
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    if (transformation) {
      uploadOptions.transformation = transformation;
    }

    // For images, apply quality optimization
    if (resourceType === 'image') {
      uploadOptions.quality = 'auto:good';
      uploadOptions.fetch_format = 'auto';
    }

    // For videos, generate a thumbnail eagerly
    if (resourceType === 'video') {
      uploadOptions.eager = [
        { width: 400, height: 300, crop: 'fill', format: 'jpg' }
      ];
      uploadOptions.eager_async = true;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete a resource from Cloudinary
 * @param {string} publicId - The public ID of the resource to delete
 * @param {string} resourceType - 'image' | 'video' | 'raw'
 * @returns {Promise<Object>} Cloudinary deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    logger.info(`Deleted from Cloudinary: ${publicId} (${resourceType})`, result);
    return result;
  } catch (error) {
    logger.error(`Failed to delete from Cloudinary: ${publicId}`, error);
    throw error;
  }
};

/**
 * Delete multiple resources from Cloudinary
 * @param {string[]} publicIds - Array of public IDs to delete
 * @param {string} resourceType - 'image' | 'video' | 'raw'
 * @returns {Promise<Object>} Cloudinary deletion result
 */
const deleteMultipleFromCloudinary = async (publicIds, resourceType = 'image') => {
  try {
    if (!publicIds || publicIds.length === 0) return null;

    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType
    });
    logger.info(`Bulk deleted from Cloudinary: ${publicIds.length} ${resourceType}(s)`, result);
    return result;
  } catch (error) {
    logger.error('Failed to bulk delete from Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  deleteMultipleFromCloudinary
};
