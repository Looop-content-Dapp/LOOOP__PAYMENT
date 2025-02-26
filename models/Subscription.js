const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  artistId: { type: String, required: true },
  tribeId: { type: String, required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true }, // Reference to Plan
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  paymentMethod: { type: String, enum: ['card', 'applepay'], required: true },
  status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'pending' },
  nextBillingDate: { type: Date },
  gracePeriodEnd: { type: Date },
  nftTokenId: { type: String },
  flutterwaveSubscriptionId: { type: String }, // Flutterwave subscription ID
}, { timestamps: true });

module.exports = mongoose.model('Subscription', SubscriptionSchema);
