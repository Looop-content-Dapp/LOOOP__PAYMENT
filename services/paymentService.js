const axios = require("axios");
const CryptoJS = require("crypto-js");
require("dotenv").config();
const Transaction = require("../models/Transaction");
const BlockchainService = require("./BlockchainService");

// Constants for Flutterwave API
const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";
const FLUTTERWAVE_SECRET_KEY = process.env.FLW_SECRET_KEY;

// Encryption function using TripleDES (3DES) with CBC mode and PKCS7 padding
function encryptData(payload) {
    const text = JSON.stringify(payload);
    const forge = require("node-forge");
    const cipher = forge.cipher.createCipher(
        "3DES-ECB",
        forge.util.createBuffer("FLWSECK_TEST1363c232db07")
    );
    cipher.start({iv: ""});
    cipher.update(forge.util.createBuffer(text, "utf-8"));
    cipher.finish();
    const encrypted = cipher.output;
    return forge.util.encode64(encrypted.getBytes());
}

// Create a one-time payment for wallet funding
const createOneTimePayment = async (
    userId,
    amount,
    paymentMethod,
    walletAddress,
    blockchain,
    cardDetails
  ) => {
    if (paymentMethod !== "card") {
      throw new Error("Only card payments are supported at this time");
    }

    const paymentData = {
      tx_ref: `tx_${Date.now()}`,
      amount,
      currency: "USD",
      email: "josephomotade0@gmail.com",
      redirect_url: "https://your_redirect_url.com",
      meta: { walletAddress, blockchain },
      card_number: cardDetails.card_number,
      cvv: cardDetails.cvv,
      expiry_month: cardDetails.expiry_month,
      expiry_year: cardDetails.expiry_year
    };
    console.log("card details", cardDetails)

    const encryptedData = encryptData(paymentData);

    try {
      const response = await axios.post(
        `${FLUTTERWAVE_BASE_URL}/charges?type=card`,
        { client: encryptedData },
        {
          headers: {
            Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Flutterwave response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Payment creation failed:", error.response?.data || error.message);
      throw new Error(`Payment creation failed: ${error.response?.data?.message || error.message}`);
    }
  };

// Verify payment and trigger USDC transfer
const verifyPayment = async (txRef) => {
  try {
    // Verify the transaction with Flutterwave
    const response = await axios.get(
      `${FLUTTERWAVE_BASE_URL}/transactions/${txRef}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    // Check if payment was successful
    if (response.data.status === "success") {
      const { walletAddress, blockchain } = response.data.data.meta;
      const transaction = await Transaction.create({
        userId: response.data.data.customer.email.split("@")[0], // Extract userId from email
        amount: response.data.data.amount,
        currency: response.data.data.currency,
        transactionHash: response.data.data.tx_ref,
        status: "success",
        paymentMethod: response.data.data.payment_type,
        flutterwaveTxRef: txRef,
        blockchain,
        walletAddress,
      });

      // Calculate USDC equivalent and update transaction
      const usdcEquivalent = await BlockchainService.calculateUSDC(response.data.data.amount);
      transaction.usdcEquivalent = usdcEquivalent;
      await transaction.save();

      // Trigger USDC transfer on the specified blockchain
      await BlockchainService.transferUSDC(blockchain, walletAddress, usdcEquivalent);

      return { transaction };
    } else {
      throw new Error("Payment verification failed");
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    throw new Error("Payment verification failed");
  }
};

// Export the functions
module.exports = {
  createOneTimePayment,
  verifyPayment,
};
