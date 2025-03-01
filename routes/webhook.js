const express = require('express');
const router = express.Router();
const PaymentService = require('../services/paymentService');
const BlockchainService = require('../services/blockchainService');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');

router.post('/flutterwave', async (req, res) => {
  const { event, data } = req.body;
  // if (req.headers['verify-hash'] !== process.env.WEBHOOK_SECRET) {
  //   return res.status(401).send('Unauthorized');
  // }

  if (event === 'charge.completed' && data.status === 'successful') {
    const result = await PaymentService.verifyPayment(data.tx_ref);
    console.log(`Claim Token ${result.claimToken} sent to vault`);
    if (result.claimToken) {
      console.log(`Claim Token ${result.claimToken} sent to vault`);
    }
  } else if (event === 'subscription.payment' && data.status === 'successful') {
    const subscription = await Subscription.findOne({ flutterwaveSubscriptionId: data.subscription_id });
    if (subscription) {
      subscription.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await subscription.save();

      const transaction = await Transaction.create({
        userId: subscription.userId,
        subscriptionId: subscription._id,
        amount: data.amount,
        currency: data.currency,
        transactionHash: data.tx_ref,
        status: 'success',
        paymentMethod: data.payment_type,
        flutterwaveTxRef: data.tx_ref,
      });

      const usdcEquivalent = await BlockchainService.calculateUSDC(data.amount);
      transaction.usdcEquivalent = usdcEquivalent;
      await transaction.save();

      const claimToken = await BlockchainService.generateClaimToken(transaction._id, usdcEquivalent);
      console.log(`Recurring payment processed: Claim Token ${claimToken}`);
    }
  }

  res.status(200).send('Webhook received');
});

router.post('/card', async (req, res) => {
    const { status, card_id, event } = req.body;
    try {
      const card = await Card.findOne({ flutterwaveCardId: card_id });
      if (!card) {
        console.error(`Card not found for ID: ${card_id}`);
        return res.status(200).send('Card webhook received');
      }

      if (event === 'card.created' && status === 'successful') {
        card.maskedPan = req.body.card_pan || card.maskedPan;
        card.status = card.type === 'virtual' ? 'active' : 'pending';
        await card.save();
        console.log(`Card ${card_id} created: ${card.type}`);
      } else if (event === 'card.shipped' && status === 'successful') {
        card.status = 'shipped';
        await card.save();
        console.log(`Physical card ${card_id} shipped`);
      } else if (event === 'card.activated' && status === 'successful') {
        card.status = 'active';
        await card.save();
        console.log(`Physical card ${card_id} activated`);
      }

      res.status(200).send('Card webhook received');
    } catch (error) {
      console.error('Card webhook error:', error);
      res.status(200).send('Card webhook received');
    }
  });

// Monitor subscriptions for grace period and NFT burning
setInterval(async () => {
  const subscriptions = await Subscription.find({ status: 'active' });
  for (const sub of subscriptions) {
    if (new Date() > sub.nextBillingDate && !sub.flutterwaveSubscriptionId) {
      sub.gracePeriodEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      await sub.save();
      if (new Date() > sub.gracePeriodEnd) {
        sub.status = 'inactive';
        await BlockchainService.burnNFT(sub._id);
        await sub.save();
      }
    }
  }
}, 24 * 60 * 60 * 1000);

module.exports = router;
