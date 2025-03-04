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
    cardDetails,
    fullname,
    email,
    phone_number
  ) => {
    if (paymentMethod !== "card") {
      throw new Error("Only card payments are supported at this time");
    }

    const paymentData = {
      fullname: fullname,
      tx_ref: `tx_${Date.now()}`,
      amount,
      currency: "USD",
      email: email,
      redirect_url: "https://your_redirect_url.com",
      meta: { walletAddress, blockchain },
      card_number: cardDetails.card_number,
      cvv: cardDetails.cvv,
      expiry_month: cardDetails.expiry_month,
      expiry_year: cardDetails.expiry_year,
      card_holder_name: fullname,
      phone_number: phone_number,
      authorization: {
        mode: 'pin',
      },
    };

    // Create initial transaction record
    const transaction = await Transaction.create({
      userId: userId,
      amount: amount,
      currency: "USD",
      transactionHash: paymentData.tx_ref,
      status: "pending",
      paymentMethod: "card",
      blockchain: blockchain,
      walletAddress: walletAddress,
      type: `Funding with ${blockchain}`,
      source: "card",
      referenceId: paymentData.tx_ref,
    });

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

      // Update transaction with Flutterwave reference
      transaction.flutterwaveTxRef = response.data.data.flw_ref;
      await transaction.save();

      return response.data;
    } catch (error) {
      // Update transaction status to failed if payment creation fails
      transaction.status = "failed";
      transaction.message = error.response?.data?.message || error.message;
      await transaction.save();

      console.error("Payment creation failed:", error.response?.data || error.message);
      throw new Error(`Payment creation failed: ${error.response?.data?.message || error.message}`);
    }
  };

// Verify payment and trigger USDC transfer
const verifyPayment = async (txRef) => {
  let transaction;
  try {
    // Fix the URL query parameter format
    const response = await axios({
      method: "get",
      url: `${FLUTTERWAVE_BASE_URL}/transactions/verify_by_reference?tx_ref=${txRef}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`
      },
    });

    console.log("Verification response:", response.data);

    // Check if payment was successful
    if (response.data.status === "success") {
      transaction.status = "success";
      transaction.paymentMethod = response.data.data.payment_type;
      await transaction.save();

      return { transaction };
    } else {
      throw new Error(response.data.message || "Payment verification failed");
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    // Now transaction is accessible here
    if (transaction) {
      transaction.status = "failed";
      transaction.message = error.response?.data?.message || error.message;
      await transaction.save();
    }
    throw new Error(error.response?.data?.message || error.message);
  }
};

// Export the functions
module.exports = {
  createOneTimePayment,
  verifyPayment,
};
