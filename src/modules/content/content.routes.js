const express = require('express');
const router = express.Router();
const contentController = require('./content.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { body, param, query } = require('express-validator');
const { validate } = require('../../middlewares/validation.middleware');

// ==================== Public Routes ====================

/**
 * @route   GET /api/v1/content/articles
 * @desc    Get articles list
 * @access  Public
 */
router.get(
  '/articles',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('category').optional().isString(),
    query('targetAudience').optional().isString(),
    query('isFeatured').optional().isBoolean(),
    query('search').optional().isString(),
    query('tag').optional().isString(),
    query('sort').optional().isIn(['newest', 'popular', 'trending']),
    validate
  ],
  contentController.getArticles
);

/**
 * @route   GET /api/v1/content/articles/:identifier
 * @desc    Get article by slug or ID
 * @access  Public
 */
router.get(
  '/articles/:identifier',
  [
    param('identifier').notEmpty().withMessage('Article identifier is required'),
    query('view').optional().isBoolean(),
    validate
  ],
  contentController.getArticle
);

/**
 * @route   GET /api/v1/content/articles/:id/related
 * @desc    Get related articles
 * @access  Public
 */
router.get(
  '/articles/:id/related',
  [
    param('id').isMongoId().withMessage('Invalid article ID'),
    query('limit').optional().isInt({ min: 1, max: 20 }),
    validate
  ],
  contentController.getRelatedArticles
);

/**
 * @route   GET /api/v1/content/featured
 * @desc    Get featured articles
 * @access  Public
 */
router.get(
  '/featured',
  [
    query('limit').optional().isInt({ min: 1, max: 20 }),
    validate
  ],
  contentController.getFeaturedArticles
);

/**
 * @route   GET /api/v1/content/trending
 * @desc    Get trending articles
 * @access  Public
 */
router.get(
  '/trending',
  [
    query('limit').optional().isInt({ min: 1, max: 20 }),
    validate
  ],
  contentController.getTrendingArticles
);

/**
 * @route   GET /api/v1/content/categories
 * @desc    Get article categories
 * @access  Public
 */
router.get('/categories', contentController.getCategories);

/**
 * @route   GET /api/v1/content/categories/:category/articles
 * @desc    Get articles by category
 * @access  Public
 */
router.get(
  '/categories/:category/articles',
  [
    param('category').notEmpty().withMessage('Category is required'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate
  ],
  contentController.getArticlesByCategory
);

/**
 * @route   GET /api/v1/content/tags
 * @desc    Get popular tags
 * @access  Public
 */
router.get(
  '/tags',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    validate
  ],
  contentController.getPopularTags
);

/**
 * @route   GET /api/v1/content/search
 * @desc    Search articles
 * @access  Public
 */
router.get(
  '/search',
  [
    query('q').notEmpty().withMessage('Search query is required'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate
  ],
  contentController.searchArticles
);

/**
 * @route   GET /api/v1/content/sitemap
 * @desc    Get sitemap data
 * @access  Public
 */
router.get('/sitemap', contentController.getSitemap);

// ==================== Protected Routes ====================

/**
 * @route   POST /api/v1/content/articles
 * @desc    Create article
 * @access  Private (Author/Admin)
 */
router.post(
  '/articles',
  authMiddleware,
  authorize('admin', 'dealer', 'builder'),
  [
    body('title').notEmpty().withMessage('Title is required').isLength({ min: 5, max: 200 }),
    body('excerpt').optional().isLength({ max: 300 }),
    body('content').notEmpty().withMessage('Content is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('featuredImage').optional().isURL(),
    body('tags').optional().isArray(),
    body('status').optional().isIn(['draft', 'pending_review']),
    validate
  ],
  contentController.createArticle
);

/**
 * @route   PUT /api/v1/content/articles/:id
 * @desc    Update article
 * @access  Private (Author/Admin)
 */
router.put(
  '/articles/:id',
  authMiddleware,
  [
    param('id').isMongoId().withMessage('Invalid article ID'),
    body('title').optional().isLength({ min: 5, max: 200 }),
    body('excerpt').optional().isLength({ max: 300 }),
    body('content').optional().isString(),
    body('category').optional().isString(),
    body('tags').optional().isArray(),
    validate
  ],
  contentController.updateArticle
);

/**
 * @route   DELETE /api/v1/content/articles/:id
 * @desc    Delete article
 * @access  Private (Author/Admin)
 */
router.delete(
  '/articles/:id',
  authMiddleware,
  [
    param('id').isMongoId().withMessage('Invalid article ID'),
    validate
  ],
  contentController.deleteArticle
);

// ==================== Admin Routes ====================

/**
 * @route   GET /api/v1/content/admin/articles
 * @desc    Admin: Get all articles
 * @access  Private/Admin
 */
router.get(
  '/admin/articles',
  authMiddleware,
  authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['draft', 'pending_review', 'published', 'archived']),
    query('author').optional().isMongoId(),
    validate
  ],
  contentController.adminGetArticles
);

/**
 * @route   PATCH /api/v1/content/admin/articles/:id/publish
 * @desc    Admin: Publish article
 * @access  Private/Admin
 */
router.patch(
  '/admin/articles/:id/publish',
  authMiddleware,
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid article ID'),
    validate
  ],
  contentController.publishArticle
);

/**
 * @route   PATCH /api/v1/content/admin/articles/:id/archive
 * @desc    Admin: Archive article
 * @access  Private/Admin
 */
router.patch(
  '/admin/articles/:id/archive',
  authMiddleware,
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid article ID'),
    validate
  ],
  contentController.archiveArticle
);

/**
 * @route   PATCH /api/v1/content/admin/articles/:id/feature
 * @desc    Admin: Toggle featured
 * @access  Private/Admin
 */
router.patch(
  '/admin/articles/:id/feature',
  authMiddleware,
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid article ID'),
    body('isFeatured').isBoolean().withMessage('isFeatured is required'),
    validate
  ],
  contentController.toggleFeatured
);

/**
 * @route   GET /api/v1/content/admin/stats
 * @desc    Admin: Get content statistics
 * @access  Private/Admin
 */
router.get(
  '/admin/stats',
  authMiddleware,
  authorize('admin'),
  contentController.getContentStats
);

module.exports = router;