const mongoose = require('mongoose');

const ClaimSchema = new mongoose.Schema({
  claimId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  status: { type: String, enum: ['pending', 'claimed', 'expired'], default: 'pending' },
  signature: { type: String },
  expiryDate: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Claim', ClaimSchema);
