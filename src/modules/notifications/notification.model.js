const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['welcome', 'chat', 'recommendation', 'system'],
    default: 'system'
  },
  read: {
    type: Boolean,
    default: false
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId, // Can be a Property ID, Chat ID, etc.
    default: null
  },
  data: {
    type: mongoose.Schema.Types.Mixed, // For any extra JSON payload
    default: {}
  }
}, {
  timestamps: true
});

// Index to quickly fetch a user's notifications sorted by newest first
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
