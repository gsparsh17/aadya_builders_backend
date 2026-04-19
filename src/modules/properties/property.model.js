const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Property title is required'],
    trim: true,
    minlength: [10, 'Title must be at least 10 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: [50, 'Description must be at least 50 characters'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  propertyCode: {
    type: String,
    unique: true,
    index: true
  },
  
  // Classification
  purpose: {
    type: String,
    enum: ['buy', 'rent', 'new_launch', 'commercial_buy', 'commercial_lease', 'land'],
    required: [true, 'Purpose is required']
  },
  propertyType: {
    type: String,
    enum: [
      'apartment', 'villa', 'independent_house', 'builder_floor',
      'plot', 'office', 'shop', 'warehouse', 'pg', 'farmhouse',
      'co_living', 'retail', 'hotel', 'guest_house'
    ],
    required: [true, 'Property type is required']
  },
  category: {
    type: String,
    enum: ['residential', 'commercial', 'agricultural', 'industrial'],
    default: 'residential'
  },
  
  // Pricing
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  pricePerSqft: {
    type: Number,
    min: [0, 'Price per sqft cannot be negative']
  },
  priceNegotiable: {
    type: Boolean,
    default: false
  },
  maintenanceCharges: {
    type: Number,
    default: 0
  },
  bookingAmount: Number,
  
  // Area Details
  area: {
    value: {
      type: Number,
      required: [true, 'Area is required'],
      min: [0, 'Area cannot be negative']
    },
    unit: {
      type: String,
      enum: ['sqft', 'sqyrd', 'sqm', 'acre', 'hectare'],
      default: 'sqft'
    }
  },
  carpetArea: Number,
  builtupArea: Number,
  superBuiltupArea: Number,
  
  // Configuration
  bedrooms: {
    type: Number,
    min: [0, 'Bedrooms cannot be negative']
  },
  bathrooms: {
    type: Number,
    min: [0, 'Bathrooms cannot be negative']
  },
  balconies: {
    type: Number,
    min: [0, 'Balconies cannot be negative'],
    default: 0
  },
  totalFloors: {
    type: Number,
    min: [0, 'Total floors cannot be negative']
  },
  floorNumber: {
    type: Number,
    min: [0, 'Floor number cannot be negative']
  },
  unitNumber: String,
  
  // Property Details
  furnishing: {
    type: String,
    enum: ['furnished', 'semi_furnished', 'unfurnished']
  },
  ageOfProperty: {
    type: Number,
    min: [0, 'Age cannot be negative'],
    max: [100, 'Age cannot exceed 100 years']
  },
  constructionStatus: {
    type: String,
    enum: ['ready_to_move', 'under_construction', 'new_launch']
  },
  possessionDate: Date,
  ownershipType: {
    type: String,
    enum: ['freehold', 'leasehold', 'cooperative', 'power_of_attorney']
  },
  facing: {
    type: String,
    enum: ['north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west']
  },
  overlooking: [String],
  
  // Location
  location: {
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    landmark: String,
    locality: {
      type: String,
      required: [true, 'Locality is required'],
      trim: true,
      index: true
    },
    subLocality: String,
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      index: true
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      match: [/^\d{6}$/, 'Please provide a valid 6-digit pincode']
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        index: '2dsphere'
      }
    }
  },
  
  // Amenities
  amenities: [{
    type: String,
    enum: [
      'lift', 'parking', 'power_backup', 'security', 'gym',
      'swimming_pool', 'club_house', 'park', 'play_area',
      'rain_water_harvesting', 'waste_disposal', 'fire_safety',
      'air_conditioning', 'heating', 'intercom', 'wifi',
      'piped_gas', 'water_storage', 'visitor_parking',
      'service_lift', 'shopping_center', 'hospital', 'school'
    ]
  }],
  
  // Media
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: String, // For cloud storage
    caption: String,
    isPrimary: {
      type: Boolean,
      default: false
    },
    order: {
      type: Number,
      default: 0
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  videoTour: {
    type: String,
    match: [/^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/, 'Please provide a valid YouTube URL']
  },
  virtualTour: String, // 360° tour URL
  floorPlan: [{
    title: String,
    imageUrl: String,
    description: String
  }],
  brochure: String, // PDF brochure URL
  
  // Ownership & Legal
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ownerType: {
    type: String,
    enum: ['individual', 'dealer', 'builder'],
    required: true
  },
  reraDetails: {
    reraId: String,
    reraProjectName: String,
    reraState: String,
    reraValidTill: Date
  },
  propertyTaxReceipt: String,
  occupancyCertificate: String,
  
  // Additional Information
  availableFrom: Date,
  preferredTenants: [{
    type: String,
    enum: ['family', 'bachelor', 'company', 'students', 'any']
  }],
  restrictions: {
    petsAllowed: { type: Boolean, default: false },
    nonVegAllowed: { type: Boolean, default: true },
    smokingAllowed: { type: Boolean, default: false },
    visitorsAllowed: { type: Boolean, default: true }
  },
  
  // Nearby Places
  nearbyPlaces: [{
    type: {
      type: String,
      enum: ['school', 'hospital', 'metro', 'market', 'mall', 'airport', 'railway', 'bus_stop']
    },
    name: String,
    distance: Number, // in km
    duration: Number // in minutes
  }],
  
  // Status & Visibility
  status: {
    type: String,
    enum: ['pending', 'active', 'sold', 'rented', 'inactive', 'rejected', 'expired'],
    default: 'pending'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDate: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: String,
  
  // Featured & Promoted
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredUntil: Date,
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumUntil: Date,
  isHot: {
    type: Boolean,
    default: false
  },
  
  // Listing Plan
  listingPlan: {
    type: {
      type: String,
      enum: ['free', 'basic', 'premium', 'featured', 'builder_showcase'],
      default: 'free'
    },
    purchasedAt: Date,
    expiresAt: Date
  },
  
  // Metrics
  views: {
    type: Number,
    default: 0
  },
  uniqueViews: {
    type: Number,
    default: 0
  },
  leads: {
    type: Number,
    default: 0
  },
  contactClicks: {
    type: Number,
    default: 0
  },
  whatsappClicks: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  favorites: {
    type: Number,
    default: 0
  },
  rankingScore: {
    type: Number,
    default: 0
  },
  
  // Project Association (for builders)
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  
  // SEO
  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String],
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  
  // Expiry
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 90 * 24 * 60 * 60 * 1000) // 90 days
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for display price
propertySchema.virtual('displayPrice').get(function() {
  if (this.purpose.includes('rent') || this.purpose.includes('lease')) {
    return `₹${this.price.toLocaleString('en-IN')}/month`;
  }
  return `₹${this.price.toLocaleString('en-IN')}`;
});

// Virtual for area in sqft
propertySchema.virtual('areaInSqft').get(function() {
  const conversionRates = {
    sqft: 1,
    sqyrd: 9,
    sqm: 10.764,
    acre: 43560,
    hectare: 107639
  };
  return this.area.value * (conversionRates[this.area.unit] || 1);
});

// Virtual for full location
propertySchema.virtual('fullLocation').get(function() {
  const parts = [
    this.location.address,
    this.location.landmark,
    this.location.locality,
    this.location.city,
    this.location.state,
    this.location.pincode
  ];
  return parts.filter(Boolean).join(', ');
});

// Virtual for primary image
propertySchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary?.url || this.images[0]?.url || null;
});

// Pre-save hook to generate property code
propertySchema.pre('save', async function(next) {
  if (!this.propertyCode) {
    const prefix = this.purpose.substring(0, 1).toUpperCase();
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.propertyCode = `${prefix}${timestamp}${random}`;
  }
  
  // Generate slug
  if (!this.slug) {
    const baseSlug = `${this.title}-${this.location.locality}-${this.location.city}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    this.slug = `${baseSlug}-${this.propertyCode.toLowerCase()}`;
  }
  
  // Calculate price per sqft
  if (this.price && this.area?.value) {
    this.pricePerSqft = Math.round(this.price / this.areaInSqft);
  }
  
  // Calculate ranking score
  this.calculateRankingScore();
  
  next();
});

// Method to calculate ranking score
propertySchema.methods.calculateRankingScore = function() {
  let score = 0;
  
  // Base score
  score += 100;
  
  // Verification bonus
  if (this.isVerified) score += 50;
  
  // Featured bonus
  if (this.isFeatured) score += 200;
  
  // Premium bonus
  if (this.isPremium) score += 100;
  
  // Listing plan bonus
  const planScores = { free: 0, basic: 30, premium: 70, featured: 150, builder_showcase: 200 };
  score += planScores[this.listingPlan?.type] || 0;
  
  // Recency bonus (newer = higher)
  const daysSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < 30) {
    score += Math.floor(30 - daysSinceCreation);
  }
  
  // Engagement bonus
  score += Math.min(this.views / 10, 20);
  score += Math.min(this.leads * 2, 30);
  score += Math.min(this.favorites * 3, 30);
  
  // Image bonus
  score += Math.min(this.images.length * 5, 25);
  
  this.rankingScore = Math.floor(score);
  return this.rankingScore;
};

// Method to increment views
propertySchema.methods.incrementViews = async function() {
  this.views += 1;
  return this.save();
};

// Method to track unique view
propertySchema.methods.trackUniqueView = async function(userId) {
  // Implementation would use Redis for tracking unique views
  this.uniqueViews += 1;
  return this.save();
};

// Indexes
propertySchema.index({ purpose: 1, 'location.city': 1, status: 1 });
propertySchema.index({ propertyCode: 1 });
propertySchema.index({ slug: 1 });
propertySchema.index({ 'location.coordinates': '2dsphere' });
propertySchema.index({ 
  title: 'text', 
  description: 'text', 
  'location.locality': 'text',
  'location.city': 'text'
}, {
  weights: {
    title: 10,
    'location.locality': 5,
    description: 3,
    'location.city': 2
  }
});
propertySchema.index({ price: 1 });
propertySchema.index({ bedrooms: 1 });
propertySchema.index({ 'area.value': 1 });
propertySchema.index({ owner: 1 });
propertySchema.index({ status: 1, isVerified: 1 });
propertySchema.index({ createdAt: -1 });
propertySchema.index({ rankingScore: -1 });
propertySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;