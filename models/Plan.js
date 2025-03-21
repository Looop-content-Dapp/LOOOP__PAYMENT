const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  artistId: { type: String, required: true }, // Unique artist identifier
  tribeId: { type: String, required: true },  // Unique tribe/community identifier
  name: { type: String, required: true },     // e.g., "Basic Tribe Access"
  amount: { type: Number, required: true },   // Monthly subscription amount
  currency: { type: String, default: 'USD' },
  description: { type: String },
  flutterwavePlanId: { type: String },        // Flutterwave plan ID after creation
}, { timestamps: true });

module.exports = mongoose.model('Plan', PlanSchema);
