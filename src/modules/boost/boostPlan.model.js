const mongoose = require('mongoose');

const boostPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, required: true, min: 1 },
  multiplier: { type: Number, default: 3 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('BoostPlan', boostPlanSchema);
