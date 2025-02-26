const express = require('express');
const router = express.Router();
const PaymentService = require('../services/paymentService');

router.post('/create-plan', async (req, res) => {
  const { artistId, tribeId, name, amount, description } = req.body;
  try {
    const plan = await PaymentService.createPaymentPlan(artistId, tribeId, name, amount, description);
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/subscribe', async (req, res) => {
  const { userId, planId, paymentMethod } = req.body;
  try {
    const result = await PaymentService.createSubscriptionPayment(userId, planId, paymentMethod);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/one-time', async (req, res) => {
  const { userId, amount, paymentMethod } = req.body;
  const result = await PaymentService.createOneTimePayment(userId, amount, paymentMethod);
  res.json(result);
});

router.get('/callback', async (req, res) => {
  const { tx_ref } = req.query;
  const result = await PaymentService.verifyPayment(tx_ref);
  res.json(result);
});

router.post('/cancel-subscription', async (req, res) => {
  const { subscriptionId } = req.body;
  const result = await PaymentService.cancelSubscription(subscriptionId);
  res.json(result);
});

router.post('/renew-subscription', async (req, res) => {
  const { subscriptionId } = req.body;
  const result = await PaymentService.renewSubscription(subscriptionId);
  res.json(result);
});

module.exports = router;
