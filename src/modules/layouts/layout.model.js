const mongoose = require('mongoose');

const layoutSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true },
  backgroundImageUrl: { type: String, required: true },
  // Image original dimensions to scale coordinates correctly on client
  imageWidth: { type: Number, required: true },
  imageHeight: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Layout', layoutSchema);
