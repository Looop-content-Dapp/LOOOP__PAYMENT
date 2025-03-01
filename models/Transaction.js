const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  artistId: { type: String }, // For artist-related transactions
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  usdcEquivalent: { type: Number },
  transactionHash: { type: String },
  status: { type: String, enum: ['success', 'pending', 'failed'], default: 'pending' },
  paymentMethod: { type: String }, // e.g., 'card', 'applepay', 'wallet'
  flutterwaveTxRef: { type: String },
  type: { type: String, enum: ['funding', 'subscription', 'tribe_join', 'collectible_received'], required: true }, // Transaction type
  source: { type: String, enum: ['card', 'wallet'], required: true }, // Source of funds
  blockchain: { type: String, enum: ['StarkNet', 'XION'], required: true }, // Blockchain used
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
