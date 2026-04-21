const { body, param, query } = require('express-validator');

const propertyValidation = {
  
  /**
   * Create property validation rules
   */
  create: [
    body('title')
      .trim()
      .notEmpty().withMessage('Property title is required')
      .isLength({ min: 10, max: 200 }).withMessage('Title must be between 10 and 200 characters'),
    
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required')
      .isLength({ min: 50, max: 5000 }).withMessage('Description must be between 50 and 5000 characters'),
    
    body('purpose')
      .notEmpty().withMessage('Purpose is required')
      .isIn(['buy', 'rent', 'new_launch', 'commercial_buy', 'commercial_lease', 'land'])
      .withMessage('Invalid purpose'),
    
    body('propertyType')
      .notEmpty().withMessage('Property type is required')
      .isIn(['apartment', 'villa', 'independent_house', 'builder_floor', 'plot', 'office', 'shop', 'warehouse', 'pg', 'farmhouse', 'co_living', 'retail'])
      .withMessage('Invalid property type'),
    
    body('price')
      .notEmpty().withMessage('Price is required')
      .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    
    body('area.value')
      .notEmpty().withMessage('Area is required')
      .isFloat({ min: 0 }).withMessage('Area must be a positive number'),
    
    body('area.unit')
      .optional()
      .isIn(['sqft', 'sqyrd', 'sqm', 'acre', 'hectare'])
      .withMessage('Invalid area unit'),
    
    body('bedrooms')
      .optional()
      .isInt({ min: 0, max: 50 }).withMessage('Bedrooms must be between 0 and 50'),
    
    body('bathrooms')
      .optional()
      .isInt({ min: 0, max: 50 }).withMessage('Bathrooms must be between 0 and 50'),
    
    body('furnishing')
      .optional()
      .isIn(['furnished', 'semi_furnished', 'unfurnished'])
      .withMessage('Invalid furnishing status'),
    
    body('location.address')
      .notEmpty().withMessage('Address is required')
      .isString().withMessage('Invalid address'),
    
    body('location.locality')
      .notEmpty().withMessage('Locality is required')
      .isString().withMessage('Invalid locality'),
    
    body('location.city')
      .notEmpty().withMessage('City is required')
      .isString().withMessage('Invalid city'),
    
    body('location.state')
      .notEmpty().withMessage('State is required')
      .isString().withMessage('Invalid state'),
    
    body('location.pincode')
      .notEmpty().withMessage('Pincode is required')
      .matches(/^\d{6}$/).withMessage('Invalid pincode'),
    
    body('location.coordinates.coordinates')
      .optional()
      .isArray({ min: 2, max: 2 }).withMessage('Coordinates must be [longitude, latitude]'),
    
    body('amenities')
      .optional()
      .isArray().withMessage('Amenities must be an array'),
    
    body('reraDetails.reraId')
      .optional()
      .isString().withMessage('Invalid RERA ID')
  ],

  /**
   * Update property validation rules
   */
  update: [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 10, max: 200 }).withMessage('Title must be between 10 and 200 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ min: 50, max: 5000 }).withMessage('Description must be between 50 and 5000 characters'),
    
    body('price')
      .optional()
      .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    
    body('area.value')
      .optional()
      .isFloat({ min: 0 }).withMessage('Area must be a positive number'),
    
    body('status')
      .optional()
      .isIn(['active', 'sold', 'rented', 'inactive']).withMessage('Invalid status'),
    
    body('furnishing')
      .optional()
      .isIn(['furnished', 'semi_furnished', 'unfurnished']).withMessage('Invalid furnishing status')
  ],

  /**
   * Search properties validation rules
   */
  search: [
    query('purpose')
      .optional()
      .isIn(['buy', 'rent', 'new_launch', 'commercial_buy', 'commercial_lease', 'land'])
      .withMessage('Invalid purpose'),
    
    query('propertyType')
      .optional()
      .isString().withMessage('Invalid property type'),
    
    query('city')
      .optional()
      .isString().withMessage('Invalid city'),
    
    query('locality')
      .optional()
      .isString().withMessage('Invalid locality'),
    
    query('minPrice')
      .optional()
      .isFloat({ min: 0 }).withMessage('Minimum price must be positive'),
    
    query('maxPrice')
      .optional()
      .isFloat({ min: 0 }).withMessage('Maximum price must be positive'),
    
    query('minArea')
      .optional()
      .isFloat({ min: 0 }).withMessage('Minimum area must be positive'),
    
    query('maxArea')
      .optional()
      .isFloat({ min: 0 }).withMessage('Maximum area must be positive'),
    
    query('bhk')
      .optional()
      .isString().withMessage('Invalid BHK configuration'),
    
    query('furnishing')
      .optional()
      .isIn(['furnished', 'semi_furnished', 'unfurnished'])
      .withMessage('Invalid furnishing status'),
    
    query('amenities')
      .optional()
      .isString().withMessage('Invalid amenities'),
    
    query('postedBy')
      .optional()
      .isIn(['owner', 'dealer', 'builder']).withMessage('Invalid posted by filter'),
    
    query('sort')
      .optional()
      .isIn(['price_asc', 'price_desc', 'newest', 'oldest', 'relevance'])
      .withMessage('Invalid sort option'),
    
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    
    query('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    
    query('radius')
      .optional()
      .isFloat({ min: 0.1, max: 50 }).withMessage('Radius must be between 0.1 and 50 km')
  ],

  /**
   * Get property by ID validation
   */
  getById: [
    param('id')
      .isMongoId().withMessage('Invalid property ID')
  ],

  /**
   * Get property by code validation
   */
  getByCode: [
    param('code')
      .notEmpty().withMessage('Property code is required')
      .isString().withMessage('Invalid property code')
  ],

  /**
   * Upload images validation
   */
  uploadImages: [
    param('id')
      .isMongoId().withMessage('Invalid property ID')
  ],

  /**
   * Delete image validation
   */
  deleteImage: [
    param('id')
      .isMongoId().withMessage('Invalid property ID'),
    param('imageId')
      .isMongoId().withMessage('Invalid image ID')
  ],

  /**
   * Set primary image validation
   */
  setPrimaryImage: [
    param('id')
      .isMongoId().withMessage('Invalid property ID'),
    param('imageId')
      .isMongoId().withMessage('Invalid image ID')
  ],

  /**
   * Update status validation
   */
  updateStatus: [
    param('id')
      .isMongoId().withMessage('Invalid property ID'),
    body('status')
      .notEmpty().withMessage('Status is required')
      .isIn(['active', 'sold', 'rented', 'inactive']).withMessage('Invalid status')
  ],

  /**
   * Get similar properties validation
   */
  getSimilar: [
    param('id')
      .isMongoId().withMessage('Invalid property ID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
  ],

  /**
   * Get nearby properties validation
   */
  getNearby: [
    query('latitude')
      .notEmpty().withMessage('Latitude is required')
      .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    query('longitude')
      .notEmpty().withMessage('Longitude is required')
      .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    query('radius')
      .optional()
      .isFloat({ min: 0.1, max: 50 }).withMessage('Radius must be between 0.1 and 50 km'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],

  /**
   * Get price trends validation
   */
  getPriceTrends: [
    query('city')
      .notEmpty().withMessage('City is required'),
    query('locality')
      .optional()
      .isString(),
    query('propertyType')
      .optional()
      .isString()
  ],

  /**
   * Contact owner validation
   */
  contactOwner: [
    param('id')
      .isMongoId().withMessage('Invalid property ID'),
    body('message')
      .optional()
      .isLength({ max: 500 }).withMessage('Message cannot exceed 500 characters'),
    body('name')
      .notEmpty().withMessage('Name is required'),
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email'),
    body('phone')
      .notEmpty().withMessage('Phone is required')
      .matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number')
  ]
};

module.exports = propertyValidation;