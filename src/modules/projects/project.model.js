const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  slug: { type: String, lowercase: true, trim: true, index: true },
  builder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  city: { type: String, required: true, trim: true, index: true },
  locality: { type: String, required: true, trim: true, index: true },
  address: { type: String, trim: true },
  description: { type: String, trim: true },
  priceRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 }
  },
  configurations: [{
    label: String,
    bedrooms: Number,
    minArea: Number,
    maxArea: Number,
    minPrice: Number,
    maxPrice: Number
  }],
  images: [{
    url: { type: String, required: true },
    publicId: String,
    caption: String,
    isPrimary: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
  }],
  amenities: [{ type: String }],
  possessionDate: Date,
  reraNumber: String,
  totalUnits: { type: Number, default: 0 },
  availableUnits: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'upcoming', 'under_construction', 'ready_to_move', 'completed', 'inactive'],
    default: 'draft',
    index: true
  },
  isFeatured: { type: Boolean, default: false, index: true },
  isVerified: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  searches: { type: Number, default: 0 }
}, { timestamps: true });

projectSchema.index({ city: 1, locality: 1, status: 1 });
projectSchema.index({ name: 'text', city: 'text', locality: 'text' });

projectSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = `${this.name}-${this.locality || this.city || ''}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);
