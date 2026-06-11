const mongoose = require('mongoose');

const shortSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  videoUrl: { type: String, required: true },
  thumbnail: String,
  caption: String,
  city: { type: String, index: true },
  locality: { type: String, index: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  views: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'active', 'inactive', 'rejected'], default: 'active', index: true }
}, { timestamps: true });

module.exports = mongoose.model('Short', shortSchema);
