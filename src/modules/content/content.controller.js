const contentService = require('./content.service');
const { successResponse, paginatedResponse, errorResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');
const { validationResult } = require('express-validator');

/**
 * Content Controller - Handles HTTP requests for content operations
 */
class ContentController {
  
  /**
   * Create article
   * @route POST /api/v1/content/articles
   */
  async createArticle(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const article = await contentService.createArticle(req.user.id, req.body);
      
      return successResponse(res, article, 'Article created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update article
   * @route PUT /api/v1/content/articles/:id
   */
  async updateArticle(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const { id } = req.params;
      
      const article = await contentService.updateArticle(id, req.user.id, req.body, req.user.role);
      
      return successResponse(res, article, 'Article updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete article
   * @route DELETE /api/v1/content/articles/:id
   */
  async deleteArticle(req, res, next) {
    try {
      const { id } = req.params;
      
      await contentService.deleteArticle(id, req.user.id, req.user.role);
      
      return successResponse(res, null, 'Article deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get article by slug or ID
   * @route GET /api/v1/content/articles/:identifier
   */
  async getArticle(req, res, next) {
    try {
      const { identifier } = req.params;
      const incrementView = req.query.view !== 'false';
      
      const article = await contentService.getArticle(identifier, incrementView);
      
      // Get related articles
      const related = await contentService.getRelatedArticles(article._id, 5);
      
      return successResponse(res, {
        article,
        related
      }, 'Article retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get articles list
   * @route GET /api/v1/content/articles
   */
  async getArticles(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const filters = {
        category: req.query.category,
        subCategory: req.query.subCategory,
        targetAudience: req.query.targetAudience,
        author: req.query.author,
        isFeatured: req.query.isFeatured,
        isTrending: req.query.isTrending,
        search: req.query.search,
        tag: req.query.tag,
        sort: req.query.sort,
        status: req.query.includeDrafts === 'true' ? undefined : 'published'
      };
      
      const result = await contentService.getArticles(filters, page, limit);
      
      return paginatedResponse(res, result.articles, page, limit, result.total, 'Articles retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get articles by category
   * @route GET /api/v1/content/categories/:category/articles
   */
  async getArticlesByCategory(req, res, next) {
    try {
      const { category } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const result = await contentService.getArticlesByCategory(category, page, limit);
      
      return paginatedResponse(res, result.articles, page, limit, result.total, 'Articles retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get featured articles
   * @route GET /api/v1/content/featured
   */
  async getFeaturedArticles(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      
      const articles = await contentService.getFeaturedArticles(limit);
      
      return successResponse(res, articles, 'Featured articles retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get trending articles
   * @route GET /api/v1/content/trending
   */
  async getTrendingArticles(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      
      const articles = await contentService.getTrendingArticles(limit);
      
      return successResponse(res, articles, 'Trending articles retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get categories
   * @route GET /api/v1/content/categories
   */
  async getCategories(req, res, next) {
    try {
      const categories = await contentService.getCategories();
      
      return successResponse(res, categories, 'Categories retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get popular tags
   * @route GET /api/v1/content/tags
   */
  async getPopularTags(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      
      const tags = await contentService.getPopularTags(limit);
      
      return successResponse(res, tags, 'Tags retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search articles
   * @route GET /api/v1/content/search
   */
  async searchArticles(req, res, next) {
    try {
      const { q } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      if (!q) {
        return errorResponse(res, 'Search query is required', 400, 'SEARCH_QUERY_REQUIRED');
      }
      
      const result = await contentService.searchArticles(q, page, limit);
      
      return paginatedResponse(res, result.articles, page, limit, result.total, 'Search results retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get related articles
   * @route GET /api/v1/content/articles/:id/related
   */
  async getRelatedArticles(req, res, next) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 5;
      
      const articles = await contentService.getRelatedArticles(id, limit);
      
      return successResponse(res, articles, 'Related articles retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== Admin Routes ====================

  /**
   * Admin: Get all articles (including drafts)
   * @route GET /api/v1/content/admin/articles
   */
  async adminGetArticles(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const filters = {
        category: req.query.category,
        status: req.query.status,
        author: req.query.author,
        search: req.query.search,
        publicOnly: false
      };
      
      const result = await contentService.getArticles(filters, page, limit);
      
      return paginatedResponse(res, result.articles, page, limit, result.total, 'Articles retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Publish article
   * @route PATCH /api/v1/content/admin/articles/:id/publish
   */
  async publishArticle(req, res, next) {
    try {
      const { id } = req.params;
      
      const article = await contentService.publishArticle(id, req.user.id);
      
      return successResponse(res, article, 'Article published successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Archive article
   * @route PATCH /api/v1/content/admin/articles/:id/archive
   */
  async archiveArticle(req, res, next) {
    try {
      const { id } = req.params;
      
      const article = await contentService.archiveArticle(id);
      
      return successResponse(res, article, 'Article archived successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Toggle featured
   * @route PATCH /api/v1/content/admin/articles/:id/feature
   */
  async toggleFeatured(req, res, next) {
    try {
      const { id } = req.params;
      const { isFeatured } = req.body;
      
      const article = await contentService.toggleFeatured(id, isFeatured);
      
      return successResponse(res, article, `Article ${isFeatured ? 'featured' : 'unfeatured'} successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Get content statistics
   * @route GET /api/v1/content/admin/stats
   */
  async getContentStats(req, res, next) {
    try {
      const stats = await contentService.getContentStats();
      
      return successResponse(res, stats, 'Content statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sitemap
   * @route GET /api/v1/content/sitemap
   */
  async getSitemap(req, res, next) {
    try {
      const sitemap = await contentService.getSitemapData();
      
      return successResponse(res, sitemap, 'Sitemap retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ContentController();