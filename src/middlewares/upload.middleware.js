const multer = require('multer');
const { AppError } = require('./errorHandler');

// Memory storage — files kept in buffer for Cloudinary upload
const storage = multer.memoryStorage();

/**
 * File filter for images only
 */
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed', 400, 'INVALID_FILE_TYPE'), false);
  }
};

/**
 * File filter for videos only
 */
const videoFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only video files are allowed', 400, 'INVALID_FILE_TYPE'), false);
  }
};

/**
 * File filter for both images and videos
 */
const mediaFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only image and video files are allowed', 400, 'INVALID_FILE_TYPE'), false);
  }
};

/**
 * Multer instance for image uploads
 * - Accepts: image/* MIME types
 * - Max file size: 5 MB
 */
const uploadImages = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

/**
 * Multer instance for video uploads
 * - Accepts: video/* MIME types
 * - Max file size: 100 MB
 */
const uploadVideos = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
});

/**
 * Multer instance for mixed media uploads (images + videos)
 * - Accepts: image/* and video/* MIME types
 * - Max file size: 100 MB
 */
const uploadMedia = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
});

module.exports = {
  uploadImages,
  uploadVideos,
  uploadMedia
};