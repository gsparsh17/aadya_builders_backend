const mongoose = require('mongoose');

const ASPECTS = ['connectivity', 'safety', 'amenities', 'cleanliness'];

/**
 * A resident's review of a locality (one per user per locality).
 */
const localityReviewSchema = new mongoose.Schema({
  city: { type: String, required: true, trim: true },
  locality: { type: String, required: true, trim: true },
  // Lower-cased copies for case-insensitive lookups and the unique index
  cityKey: { type: String, required: true, index: true },
  localityKey: { type: String, required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  aspects: {
    connectivity: { type: Number, min: 1, max: 5 },
    safety: { type: Number, min: 1, max: 5 },
    amenities: { type: Number, min: 1, max: 5 },
    cleanliness: { type: Number, min: 1, max: 5 },
  },
  likes: { type: String, maxlength: 600 },
  dislikes: { type: String, maxlength: 600 },
  relation: { type: String, enum: ['resident', 'tenant', 'owner', 'visitor'], default: 'resident' },
  status: { type: String, enum: ['published', 'hidden'], default: 'published' },
}, { timestamps: true });

localityReviewSchema.index({ cityKey: 1, localityKey: 1, user: 1 }, { unique: true });

localityReviewSchema.statics.ASPECTS = ASPECTS;

module.exports = mongoose.model('LocalityReview', localityReviewSchema);
