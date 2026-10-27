const mongoose = require('mongoose');

/**
 * A user's report that a listing is fake, already sold, mispriced, etc.
 * Reviewed by admins from the admin panel.
 */
const reportSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: {
    type: String,
    enum: ['fraud', 'already_sold', 'wrong_details', 'wrong_price', 'duplicate', 'broker_as_owner', 'other'],
    required: true,
  },
  details: { type: String, maxlength: 500 },
  status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open', index: true },
  resolution: String,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
}, { timestamps: true });

// One report per user per listing
reportSchema.index({ property: 1, reporter: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
