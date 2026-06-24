const mongoose = require('mongoose');

const plotSchema = new mongoose.Schema({
  layoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Layout', required: true, index: true },
  plotNumber: { type: String, required: true },
  // Array of {x, y} coordinates mapping the polygon on the background image
  coordinates: [{
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  }],
  status: {
    type: String,
    enum: ['available', 'locked', 'booked'],
    default: 'available',
    index: true
  },
  price: { type: Number },
  area: { type: Number },
  // Information about locking
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lockedUntil: { type: Date, default: null, index: { expireAfterSeconds: 0 } }, // TTL index for automatic unlocking
  // Information about booking
  bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Plot', plotSchema);
