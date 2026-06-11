const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  type: { type: String, enum: ['helpful', 'app_rating', 'locality_rating', 'society_rating'], required: true, index: true },
  screen: String,
  section: String,
  helpful: Boolean,
  rating: { type: Number, min: 1, max: 5 },
  city: String,
  locality: String,
  society: String,
  comment: String,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
