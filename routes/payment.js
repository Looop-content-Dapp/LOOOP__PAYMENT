const express = require('express');
const router = express.Router();
const PaymentService = require('../services/PaymentService');

router.post('/fund-wallet', async (req, res) => {
  const { userId, amount, paymentMethod, walletAddress, blockchain } = req.body;
  if (!userId || !amount || !paymentMethod || !walletAddress || !blockchain) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    if (!['Starknet', 'XION'].includes(blockchain)) {
      throw new Error('Invalid blockchain specified');
    }
    const result = await PaymentService.createOneTimePayment(
      userId,
      amount,
      paymentMethod,
      walletAddress,
      blockchain
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/callback', async (req, res) => {
  const { tx_ref } = req.query;
  if (!tx_ref) {
    return res.status(400).json({ error: 'tx_ref is required' });
  }
  try {
    const result = await PaymentService.verifyOneTimePayment(tx_ref);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
