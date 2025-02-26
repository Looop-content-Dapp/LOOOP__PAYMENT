const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  usdcEquivalent: { type: Number },
  transactionHash: { type: String },
  status: { type: String, enum: ['success', 'pending', 'failed'], default: 'pending' },
  paymentMethod: { type: String, required: true },
  flutterwaveTxRef: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
