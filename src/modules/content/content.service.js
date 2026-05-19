const Article = require('./article.model');
const User = require('../users/user.model');
const Property = require('../properties/property.model');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const slugify = require('slugify');
const redisClient = require('../../config/redis');

/**
 * Content Service - Handles all content operations
 */
class ContentService {
  
  /**
   * Create a new article
   */
  async createArticle(authorId, articleData) {
    const {
      title,
      excerpt,
      content,
      category,
      subCategory,
      targetAudience,
      featuredImage,
      tags,
      metaTitle,
      metaDescription,
      metaKeywords,
      status = 'draft',
      scheduledPublishAt
    } = articleData;
    
    // Generate slug
    let baseSlug = slugify(title, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;
    
    while (await Article.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    // Get author details
    const author = await User.findById(authorId).select('name profilePicture');
    
    const article = await Article.create({
      title,
      slug,
      excerpt,
      content,
      category,
      subCategory,
      targetAudience: targetAudience || ['all'],
      featuredImage,
      tags: tags || [],
      author: authorId,
      authorName: author.name,
      authorBio: author.bio,
      metaTitle: metaTitle || `${title} | 99acres Insights`,
      metaDescription: metaDescription || excerpt?.substring(0, 160),
      metaKeywords: metaKeywords || tags,
      status,
      scheduledPublishAt
    });
    
    // Clear cache
    await this.clearContentCache();
    
    return article;
  }

  /**
   * Update an article
   */
  async updateArticle(articleId, userId, updateData, userRole) {
    const article = await Article.findById(articleId);
    
    if (!article) {
      throw new AppError('Article not found', 404, 'ARTICLE_NOT_FOUND');
    }
    
    // Check permission (author or admin)
    if (userRole !== 'admin' && article.author.toString() !== userId) {
      throw new AppError('You do not have permission to update this article', 403, 'FORBIDDEN');
    }
    
    // Handle slug update if title changed
    if (updateData.title && updateData.title !== article.title) {
      let baseSlug = slugify(updateData.title, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;
      
      while (await Article.findOne({ slug, _id: { $ne: articleId } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      updateData.slug = slug;
    }
    
    // Add revision if content changed
    if (updateData.content && updateData.content !== article.content) {
      if (!article.revisions) article.revisions = [];
      article.revisions.push({
        content: article.content,
        editedBy: userId,
        editedAt: new Date(),
        changeSummary: updateData.changeSummary || 'Content updated'
      });
    }
    
    // Update fields
    Object.keys(updateData).forEach(key => {
      if (key !== '_id' && key !== 'author' && key !== 'changeSummary') {
        article[key] = updateData[key];
      }
    });
    
    await article.save();
    
    // Clear cache
    await this.clearContentCache();
    
    return article;
  }

  /**
   * Delete an article
   */
  async deleteArticle(articleId, userId, userRole) {
    const article = await Article.findById(articleId);
    
    if (!article) {
      throw new AppError('Article not found', 404, 'ARTICLE_NOT_FOUND');
    }
    
    // Check permission
    if (userRole !== 'admin' && article.author.toString() !== userId) {
      throw new AppError('You do not have permission to delete this article', 403, 'FORBIDDEN');
    }
    
    await Article.findByIdAndDelete(articleId);
    
    // Clear cache
    await this.clearContentCache();
    
    return true;
  }

  /**
   * Get article by ID or slug
   */
  async getArticle(identifier, incrementView = true) {
    const query = identifier.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: identifier }
      : { slug: identifier };
    
    const article = await Article.findOne(query)
      .populate('author', 'name profilePicture bio')
      .populate('contributors.user', 'name profilePicture')
      .populate('relatedArticles', 'title slug featuredImage category')
      .populate('relatedProperties', 'title price location primaryImage');
    
    if (!article) {
      throw new AppError('Article not found', 404, 'ARTICLE_NOT_FOUND');
    }
    
    // Increment view count
    if (incrementView) {
      article.views += 1;
      await article.save();
    }
    
    return article;
  }

  /**
   * Get articles list with filters
   */
  async getArticles(filters = {}, page = 1, limit = 20) {
    const query = {};
    
    // Only show published articles for public
    if (filters.publicOnly !== false) {
      query.status = 'published';
    } else if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.category) {
      query.category = filters.category;
    }
    
    if (filters.subCategory) {
      query.subCategory = filters.subCategory;
    }
    
    if (filters.targetAudience) {
      query.targetAudience = { $in: [filters.targetAudience, 'all'] };
    }
    
    if (filters.author) {
      query.author = filters.author;
    }
    
    if (filters.isFeatured !== undefined) {
      query.isFeatured = filters.isFeatured === 'true';
    }
    
    if (filters.isTrending !== undefined) {
      query.isTrending = filters.isTrending === 'true';
    }
    
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { excerpt: { $regex: filters.search, $options: 'i' } },
        { tags: { $in: [new RegExp(filters.search, 'i')] } }
      ];
    }
    
    if (filters.tag) {
      query.tags = filters.tag;
    }
    
    const skip = (page - 1) * limit;
    
    let sortOptions = { publishedAt: -1, createdAt: -1 };
    if (filters.sort === 'popular') {
      sortOptions = { views: -1 };
    } else if (filters.sort === 'trending') {
      sortOptions = { views: -1, publishedAt: -1 };
    }
    
    const [articles, total] = await Promise.all([
      Article.find(query)
        .populate('author', 'name profilePicture')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .select('-content -revisions'),
      Article.countDocuments(query)
    ]);
    
    return {
      articles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get articles by category
   */
  async getArticlesByCategory(category, page = 1, limit = 20) {
    return this.getArticles({ category, publicOnly: true }, page, limit);
  }

  /**
   * Get featured articles
   */
  async getFeaturedArticles(limit = 5) {
    const articles = await Article.find({
      status: 'published',
      isFeatured: true
    })
      .populate('author', 'name profilePicture')
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select('-content');
    
    return articles;
  }

  /**
   * Get trending articles
   */
  async getTrendingArticles(limit = 5) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const articles = await Article.find({
      status: 'published',
      publishedAt: { $gte: sevenDaysAgo }
    })
      .populate('author', 'name profilePicture')
      .sort({ views: -1 })
      .limit(limit)
      .select('-content');
    
    return articles;
  }

  /**
   * Get related articles
   */
  async getRelatedArticles(articleId, limit = 5) {
    const article = await Article.findById(articleId);
    
    if (!article) {
      return [];
    }
    
    const related = await Article.find({
      _id: { $ne: articleId },
      status: 'published',
      $or: [
        { category: article.category },
        { tags: { $in: article.tags } }
      ]
    })
      .populate('author', 'name')
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select('title slug featuredImage category publishedAt');
    
    return related;
  }

  /**
   * Get article categories with counts
   */
  async getCategories() {
    const categories = await Article.aggregate([
      { $match: { status: 'published' } },
      { $group: {
        _id: '$category',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } }
    ]);
    
    const categoryMap = {
      buyer_guide: 'Buyer Guides',
      tenant_guide: 'Tenant Guides',
      owner_guide: 'Owner Guides',
      dealer_guide: 'Dealer Guides',
      builder_guide: 'Builder Guides',
      news: 'Real Estate News',
      legal_tax: 'Legal & Tax',
      interior_design: 'Interior Design',
      market_trends: 'Market Trends',
      policy: 'Policies & Regulations',
      investment: 'Investment',
      home_loan: 'Home Loan',
      real_estate_basics: 'Real Estate Basics',
      locality_reviews: 'Locality Reviews',
      expert_opinion: 'Expert Opinion'
    };
    
    return categories.map(c => ({
      id: c._id,
      name: categoryMap[c._id] || c._id,
      count: c.count
    }));
  }

  /**
   * Get popular tags
   */
  async getPopularTags(limit = 20) {
    const tags = await Article.aggregate([
      { $match: { status: 'published' } },
      { $unwind: '$tags' },
      { $group: {
        _id: '$tags',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
    
    return tags;
  }

  /**
   * Search articles
   */
  async searchArticles(query, page = 1, limit = 20) {
    return this.getArticles({ search: query, publicOnly: true }, page, limit);
  }

  /**
   * Publish article
   */
  async publishArticle(articleId, userId) {
    const article = await Article.findById(articleId);
    
    if (!article) {
      throw new AppError('Article not found', 404, 'ARTICLE_NOT_FOUND');
    }
    
    article.status = 'published';
    article.publishedAt = new Date();
    article.reviewedBy = userId;
    article.reviewedAt = new Date();
    
    await article.save();
    
    // Clear cache
    await this.clearContentCache();
    
    return article;
  }

  /**
   * Archive article
   */
  async archiveArticle(articleId) {
    const article = await Article.findById(articleId);
    
    if (!article) {
      throw new AppError('Article not found', 404, 'ARTICLE_NOT_FOUND');
    }
    
    article.status = 'archived';
    await article.save();
    
    await this.clearContentCache();
    
    return article;
  }

  /**
   * Toggle featured status
   */
  async toggleFeatured(articleId, isFeatured) {
    const article = await Article.findByIdAndUpdate(
      articleId,
      { isFeatured },
      { new: true }
    );
    
    if (!article) {
      throw new AppError('Article not found', 404, 'ARTICLE_NOT_FOUND');
    }
    
    await this.clearContentCache();
    
    return article;
  }

  /**
   * Get content statistics
   */
  async getContentStats() {
    const stats = await Article.aggregate([
      { $facet: {
        overview: [
          { $group: {
            _id: null,
            totalArticles: { $sum: 1 },
            publishedArticles: {
              $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
            },
            draftArticles: {
              $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
            },
            totalViews: { $sum: '$views' }
          }}
        ],
        byCategory: [
          { $match: { status: 'published' } },
          { $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgViews: { $avg: '$views' }
          }},
          { $sort: { count: -1 } }
        ],
        byMonth: [
          { $match: { status: 'published' } },
          { $group: {
            _id: {
              year: { $year: '$publishedAt' },
              month: { $month: '$publishedAt' }
            },
            count: { $sum: 1 }
          }},
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 12 }
        ],
        topAuthors: [
          { $match: { status: 'published' } },
          { $group: {
            _id: '$author',
            articles: { $sum: 1 },
            totalViews: { $sum: '$views' }
          }},
          { $sort: { articles: -1 } },
          { $limit: 10 },
          { $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'author'
          }},
          { $unwind: '$author' },
          { $project: {
            authorId: '$_id',
            name: '$author.name',
            articles: 1,
            totalViews: 1
          }}
        ]
      }}
    ]);
    
    return stats[0] || {};
  }

  /**
   * Clear content cache
   */
  async clearContentCache() {
    try {
      const client = await redisClient.getRedisClient();
      if (!client) return;
      const keys = await client.keys('content:*');
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      logger.error('Failed to clear content cache:', error);
    }
  }

  /**
   * Get sitemap data
   */
  async getSitemapData() {
    const articles = await Article.find({ status: 'published' })
      .select('slug updatedAt')
      .sort({ updatedAt: -1 });
    
    const properties = await Property.find({ status: 'active' })
      .select('slug updatedAt')
      .sort({ updatedAt: -1 });
    
    return {
      articles: articles.map(a => ({
        url: `/insights/${a.slug}`,
        lastmod: a.updatedAt.toISOString().split('T')[0]
      })),
      properties: properties.map(p => ({
        url: `/property/${p.slug}`,
        lastmod: p.updatedAt.toISOString().split('T')[0]
      }))
    };
  }
}

module.exports = new ContentService();