const mongoose = require('mongoose');
const slugify = require('slugify');

const articleSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  excerpt: {
    type: String,
    maxlength: [300, 'Excerpt cannot exceed 300 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  
  // Classification
  category: {
    type: String,
    enum: [
      'buyer_guide', 'tenant_guide', 'owner_guide', 'dealer_guide',
      'builder_guide', 'news', 'legal_tax', 'interior_design',
      'market_trends', 'policy', 'investment', 'home_loan',
      'real_estate_basics', 'locality_reviews', 'expert_opinion'
    ],
    required: [true, 'Category is required']
  },
  subCategory: String,
  
  // Target Audience
  targetAudience: [{
    type: String,
    enum: ['buyer', 'tenant', 'owner', 'dealer', 'builder', 'investor', 'all']
  }],
  
  // Media
  featuredImage: {
    url: String,
    alt: String,
    caption: String,
    credit: String
  },
  gallery: [{
    url: String,
    alt: String,
    caption: String
  }],
  videoUrl: String,
  
  // Author
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: String, // Snapshot
  authorBio: String,
  
  // Contributors
  contributors: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: String,
    name: String
  }],
  
  // Tags and SEO
  tags: [String],
  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String],
  focusKeyword: String,
  
  // Publishing
  status: {
    type: String,
    enum: ['draft', 'pending_review', 'scheduled', 'published', 'archived'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'password_protected'],
    default: 'public'
  },
  password: String, // If password protected
  
  // Scheduling
  scheduledPublishAt: Date,
  publishedAt: Date,
  unpublishedAt: Date,
  
  // Engagement
  views: {
    type: Number,
    default: 0
  },
  uniqueViews: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  comments: {
    type: Number,
    default: 0
  },
  averageReadTime: Number, // in seconds
  
  // Comments
  commentSettings: {
    enabled: { type: Boolean, default: true },
    moderation: { type: Boolean, default: true }
  },
  
  // Related Content
  relatedArticles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article'
  }],
  relatedProperties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  }],
  
  // Featured
  isFeatured: {
    type: Boolean,
    default: false
  },
  isTrending: {
    type: Boolean,
    default: false
  },
  isEditorsPick: {
    type: Boolean,
    default: false
  },
  
  // Internal
  internalNotes: String,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  
  // Version History
  revisions: [{
    content: String,
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    editedAt: Date,
    changeSummary: String
  }]
  
}, {
  timestamps: true
});

// Pre-save hook to generate slug
articleSchema.pre('save', async function(next) {
  if (this.isModified('title') || !this.slug) {
    let baseSlug = slugify(this.title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
    
    // Check for existing slug
    const Article = mongoose.model('Article');
    let slug = baseSlug;
    let counter = 1;
    
    while (await Article.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    this.slug = slug;
  }
  
  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Capture author name
  if (this.isModified('author') && this.author) {
    const User = mongoose.model('User');
    const author = await User.findById(this.author).select('name');
    if (author) {
      this.authorName = author.name;
    }
  }
  
  // Set meta title if not provided
  if (!this.metaTitle) {
    this.metaTitle = `${this.title} | 99acres Insights`;
  }
  
  // Set meta description from excerpt if not provided
  if (!this.metaDescription && this.excerpt) {
    this.metaDescription = this.excerpt.substring(0, 160);
  }
  
  next();
});

// Method to increment views
articleSchema.methods.incrementViews = async function() {
  this.views += 1;
  return this.save();
};

// Method to add revision
articleSchema.methods.addRevision = async function(userId, changeSummary) {
  this.revisions.push({
    content: this.content,
    editedBy: userId,
    editedAt: new Date(),
    changeSummary: changeSummary
  });
  
  return this.save();
};

// Indexes
articleSchema.index({ slug: 1 });
articleSchema.index({ category: 1, status: 1 });
articleSchema.index({ targetAudience: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ isFeatured: 1, publishedAt: -1 });
articleSchema.index({ 
  title: 'text', 
  content: 'text', 
  tags: 'text',
  excerpt: 'text'
}, {
  weights: {
    title: 10,
    tags: 5,
    excerpt: 3,
    content: 1
  }
});

const Article = mongoose.model('Article', articleSchema);

module.exports = Article;