const express = require("express");
const router = express.Router();
const PaymentService = require("../services/paymentService");


router.post("/fund-wallet", async (req, res) => {
  const { userId, amount, paymentMethod, walletAddress, blockchain } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!userId) missingFields.push("userId");
  if (!amount) missingFields.push("amount");
  if (!paymentMethod) missingFields.push("paymentMethod");
  if (!walletAddress) missingFields.push("walletAddress");
  if (!blockchain) missingFields.push("blockchain");

  if (missingFields.length > 0) {
    return res
      .status(400)
      .json({ error: `Missing required fields: ${missingFields.join(", ")}` });
  }

  // Validate blockchain
  if (!["Starknet", "XION"].includes(blockchain)) {
    return res.status(400).json({ error: "Invalid blockchain specified" });
  }

  try {
    const result = await PaymentService.createOneTimePayment(
      userId,
      amount,
      paymentMethod,
      walletAddress,
      blockchain
    );

    console.log("this is result", result)

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/callback", async (req, res) => {
  const { tx_ref } = req.query;
  if (!tx_ref) {
    return res.status(400).json({ error: "tx_ref is required" });
  }
  try {
    const result = await PaymentService.verifyOneTimePayment(tx_ref);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
