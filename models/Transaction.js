const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  referenceId: { type: String, unique: false, sparse: false },  // Added referenceId field
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  usdcEquivalent: { type: Number, required: false },
  transactionHash: { type: String },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  paymentMethod: { type: String, enum: ['card', 'applepay'], required: true },
  flutterwaveTxRef: { type: String },
  type: { type: String, default: 'funding' },
  source: { type: String, enum: ['card', 'applepay'], default: 'card' },
  blockchain: { type: String, enum: ['Starknet', 'XION'], required: true },
  title: { type: String },
  message: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('Transaction', TransactionSchema);
