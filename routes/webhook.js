const express = require('express');
const router = express.Router();
const PaymentService = require('../services/paymentService');
const BlockchainService = require('../services/blockchainService');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');

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
