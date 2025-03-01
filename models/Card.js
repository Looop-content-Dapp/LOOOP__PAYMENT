const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, enum: ['virtual', 'physical'], required: true },
  flutterwaveCardId: { type: String, required: true }, // Unique ID from Flutterwave
  maskedPan: { type: String }, // Masked card number, e.g., "4056********1123"
  balance: { type: Number, default: 0 }, // In USD/USDC
  currency: { type: String, default: 'USD' },
  status: { type: String, enum: ['active', 'inactive', 'pending', 'shipped'], default: 'pending' }, // Added 'shipped' for physical
}, { timestamps: true });

module.exports = mongoose.model('Card', CardSchema);
