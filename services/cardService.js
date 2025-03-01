const Flutterwave = require('flutterwave-node-v3');
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
const Card = require('../models/Card');
const Wallet = require('../models/Wallet');

class CardService {
  // Create Virtual or Physical Card
  async createCard(userId, type) {
    const cardData = {
      currency: 'USD',
      amount: 0, // Initial funding
      billing_name: `${userId} Card`,
      callback_url: 'http://localhost:3000/webhook/card', // Webhook for status updates
    };

    let response;
    if (type === 'virtual') {
      response = await flw.VirtualCard.create(cardData);
    } else if (type === 'physical') {
    //   // Hypothetical physical card creation (requires Flutterwave confirmation)
    //   // This is a placeholder; adjust based on actual API
    //   response = await flw.VirtualCard.create({
    //     ...cardData,
    //     is_physical: true, // Hypothetical flag
    //     shipping_address: '123 Artist Lane, Music City, USA', // Example; customize as needed
    //   });

     console.log("Physical Card are coming soon")
    }

    if (response.status === 'success') {
      const card = await Card.create({
        userId,
        type,
        flutterwaveCardId: response.data.id || response.data.card_id,
        maskedPan: response.data.card_pan || 'N/A',
        status: type === 'virtual' ? 'active' : 'pending', // Physical cards start as pending
      });
      return card;
    }
    throw new Error(`Failed to create ${type} card`);
  }

  // Transfer USDC from Wallet to Card
  async transferToCard(userId, cardId, amount) {
    const card = await Card.findById(cardId);
    const wallet = await Wallet.findOne({ userId });
    if (!card || !wallet) throw new Error('Card or wallet not found');
    if (wallet.usdcBalance < amount) throw new Error('Insufficient USDC balance');
    if (card.status !== 'active') throw new Error('Card is not active');

    const fundData = {
      id: card.flutterwaveCardId,
      amount,
      debit_currency: 'USD', // Assuming USDC as USD equivalent
    };
    const response = await flw.VirtualCard.fund(fundData);

    if (response.status === 'success') {
      wallet.usdcBalance -= amount;
      card.balance += amount;
      await wallet.save();
      await card.save();
      return { card, wallet };
    }
    throw new Error('Transfer failed');
  }
}

module.exports = new CardService();
