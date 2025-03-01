const express = require('express');
const router = express.Router();
const CardService = require('../services/cardService');

router.post('/create', async (req, res) => {
  const { userId, type } = req.body;
  try {
    const card = await CardService.createCard(userId, type);
    res.json({
      cardId: card._id,
      type: card.type,
      flutterwaveCardId: card.flutterwaveCardId,
      maskedPan: card.maskedPan,
      status: card.status,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/transfer', async (req, res) => {
  const { userId, cardId, amount } = req.body;
  try {
    const result = await CardService.transferToCard(userId, cardId, amount);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
