const express = require("express");
const router = express.Router();
const PaymentService = require("../services/paymentService");

// Route to initiate wallet funding
router.post("/fund-wallet", async (req, res) => {
  const { userId, amount, paymentMethod, walletAddress, blockchain, cardDetails } = req.body;

  // Validate required fields
  if (
    !userId ||
    !amount ||
    !paymentMethod ||
    !walletAddress ||
    !blockchain ||
    !cardDetails ||
    !cardDetails.card_number ||
    !cardDetails.cvv ||
    !cardDetails.expiry_month ||
    !cardDetails.expiry_year
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Call the PaymentService to create a one-time payment
    const result = await PaymentService.createOneTimePayment(
      userId,
      amount,
      paymentMethod,
      walletAddress,
      blockchain,
      cardDetails
    );

    // Respond with the payment link and transaction reference
    res.json({ paymentLink: result.data.link, txRef: result.data.tx_ref });
  } catch (error) {
    // Handle any errors from the PaymentService
    res.status(500).json({ error: error.message });
  }
});

// Route to handle payment callback and verify payment
router.get("/callback", async (req, res) => {
  const { tx_ref } = req.query;

  // Validate transaction reference
  if (!tx_ref) {
    return res.status(400).json({ error: "tx_ref is required" });
  }

  try {
    // Call the PaymentService to verify the payment
    const result = await PaymentService.verifyPayment(tx_ref);

    // Respond with the verification result
    res.json(result);
  } catch (error) {
    // Handle any errors from the PaymentService
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
