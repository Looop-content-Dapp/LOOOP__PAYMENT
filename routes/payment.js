const express = require("express");
const router = express.Router();
const PaymentService = require("../services/paymentService");

// Route to initiate wallet funding
router.post("/fund-wallet", async (req, res) => {
  const { userId, amount, paymentMethod, walletAddress, blockchain, cardDetails, fullname, email, phone_number } = req.body;

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
      cardDetails,
      fullname,
      email,
      phone_number
    );
     console.log("result", result)
    // Respond with the payment link and transaction reference
    res.json({ meta: result.meta, txRef: result.data.flw_ref, customer: result.customer, result: result  });
  } catch (error) {
    // Handle any errors from the PaymentService
    res.status(500).json({ error: error.message });
  }
});

// Route to handle payment callback and verify payment
router.get("/callback", async (req, res) => {
  const { flw_ref } = req.query;

  // Validate transaction reference
  if (!flw_ref) {
    return res.status(400).json({ error: "flw_ref is required" });
  }

  try {
    // Call the PaymentService to verify the payment
    const result = await PaymentService.verifyPayment(flw_ref);

    // Respond with the verification result
    res.json(result);
  } catch (error) {
    // Handle any errors from the PaymentService
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
