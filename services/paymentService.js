const axios = require("axios");
require("dotenv").config();
const CryptoJS = require("crypto-js");

const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3"; // Base URL for Flutterwave API
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY;
const FLUTTERWAVE_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLUTTERWAVE_ENCRYPTION_KEY = process.env.FLW_ENCRYPTION_KEY;

const Transaction = require("../models/Transaction");
const BlockchainService = require("./BlockchainService");
const { Plan } = require("../models/plan.model");
const { Subscription } = require("../models/subscription.model");

// Function to encrypt data using 3DES
function encrypt(payload) {
  const text = JSON.stringify(payload);
  const forge = require("node-forge");
  const cipher = forge.cipher.createCipher(
    "3DES-ECB",
    forge.util.createBuffer("FLWSECK_TEST1363c232db07")
  );
  cipher.start({ iv: "1234567" });
  cipher.update(forge.util.createBuffer(text, "utf-8"));
  cipher.finish();
  const encrypted = cipher.output;

  const encryptedBase64 = forge.util.encode64(encrypted.getBytes());
  console.log(
    "this one",
    JSON.stringify({ client: encryptedBase64.toString() })
  );
  return JSON.stringify({ client: encryptedBase64.toString() });
}
const encryptData = (data) => {
  const key = CryptoJS.enc.Utf8.parse("FLWSECK_TEST1363c232db07"); // Use your secret key
  const iv = CryptoJS.enc.Utf8.parse("12345678"); // Initialization vector (IV) - must be 8 bytes
  const encrypted = CryptoJS.TripleDES.encrypt(JSON.stringify(data), key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  console.log("encrypted to: ", encrypted.toString());
  return encrypted.toString();
};

encryptData("data");
encrypt("data");
// Function to create a one-time payment
const createOneTimePayment = async (
  userId,
  amount,
  paymentMethod,
  walletAddress,
  blockchain
) => {
  const paymentData = {
    tx_ref: `tx_${Date.now()}`,
    amount,
    currency: "USD", // Adjust as necessary
    payment_options: "card", // Explicitly set to card payment
    customer: { email: userId }, // Add customer_email parameter
    redirect_url: "http://localhost:8000/callback", // Set your redirect URL
    // Add any other necessary fields based on Flutterwave API documentation
  };

  // Encrypt the payment data if needed
  // const encryptedData = encrypt(paymentData);

  try {
    const response = await axios.post(
      `${FLUTTERWAVE_BASE_URL}/payments`,
      paymentData, // Directly send paymentData as the request body
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, // Use the correct secret key
          "Content-Type": "application/json",
        },
      }
    );

    const { data } = response; // Destructure response to get data directly

    if (data.status === "success") {
      return { paymentLink: data.data.link, tx_ref: paymentData.tx_ref }; // Ensure tx_ref is returned correctly
    } else {
      throw new Error(`Payment failed: ${data.message || "Unknown error"}`); // Handle non-success status
    }
  } catch (error) {
    throw new Error(
      `Payment creation failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

// Function to verify a one-time payment
async function verifyOneTimePayment(tx_ref) {
  try {
    const response = await axios.get(
      `${FLUTTERWAVE_BASE_URL}/transactions/${txRef}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, // Use the correct secret key
        },
      }
    );

    const { data } = response; // Destructure response to get data directly
    return data; // Return the response data directly
  } catch (error) {
    throw new Error(
      `Payment verification failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

class PaymentService {
  //Create a payment plan for an artist's tribe
  async createPaymentPlan(artistId, tribeId, name, amount, description) {
    const planData = {
      name: `${name} - ${tribeId}`,
      amount,
      interval: "monthly", // Monthly billing
      currency: "USD" || "NGN",
    };

    const response = await axios.post(
      `${FLUTTERWAVE_BASE_URL}/payment-plans`,
      planData,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    console.log("plan created successfully!");
    if (response.data.status === "success") {
      const plan = await Plan.create({
        artistId,
        tribeId,
        name,
        amount,
        description,
        flutterwavePlanId: response.data.data.id,
      });

      return plan;
    }
    throw new Error("fail to create a payment plan!");
  }

  // Subscribe a user to an artist's plan
  async createSubscriptionPayment(userId, planId, paymentMethod) {
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new Error("plan not found!");
    }
    const txRef = `sub_${Date.now()}`;
    const subscription = await Subscription.create({
      userId,
      artistId: plan.artistId,
      tribeId: plan.tribeId,
      planId: plan._id,
      amount: plan.amount,
      paymentMethod,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    const paymentData = {
      tx_ref: txRef,
      amount: plan.amount,
      currency: "USD" || "NGN",
      payment_options: paymentMethod === "applepay" ? "applepay" : "card",
      customer: { email: userId }, //customer email will be here
      redirect_url: "http://localhost:8000/callback",
      meta: { subscriptionId: subscription._id },
      payment_plan: plan.flutterwavePlanId, // Link to Flutterwave plan
    };
    const response = await axios.post(
      `${FLUTTERWAVE_BASE_URL}/charges?type=mobilemoneyghana`,
      paymentData,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );
    if (response.data.status === "success") {
      return {
        paymentLink: response.data.data.link,
        subscriptionId: subscription._id,
        txRef,
      };
    }
    throw new Error("Payment initiation failed!");
  }

  async verifyPayment(txRef) {
    const response = await axios.get(
      `${FLUTTERWAVE_BASE_URL}/transactions/${txRef}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );
    if (response.data.status === "success") {
      const transaction = await Transaction.create({
        userId: response.data.data.customer.email.split("@")[0],
        amount: response.data.data.amount,
        currency: response.data.data.currency,
        transactionHash: response.data.data.tx_ref,
        status: "success",
        paymentMethod: response.data.data.payment_type,
        flutterwaveTxRef: txRef,
      });
      if (response.data.data.meta?.subscriptionId) {
        const subscription = await Subscription.findById(
          response.data.data.meta.subscriptionId
        );
        subscription.status = "active";
        subscription.flutterwaveSubscriptionId =
          response.data.data.payment_plan?.subscription_id || txRef; // Fallback to txRef if no subscription ID
        await subscription.save();
        const usdcEquivalent = await calculateUSDC(response.data.data.amount);
        transaction.usdcEquivalent = usdcEquivalent;
        await transaction.save();
        console.log("token created here");
      }
      return { transaction };
    }
    throw new Error("Payment verification failed");
  }

  // Cancel Subscription
  async cancelSubscription(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (subscription.flutterwaveSubscriptionId) {
      await axios.delete(
        `${FLUTTERWAVE_BASE_URL}/subscriptions/${subscription.flutterwaveSubscriptionId}`,
        {
          headers: {
            Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          },
        }
      );
    }
    subscription.status = "inactive";
    subscription.gracePeriodEnd = new Date(
      Date.now() + 5 * 24 * 60 * 60 * 1000
    );
    await subscription.save();
    return subscription;
  }

  // Renew Subscription (Manual Trigger)
  async renewSubscription(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (
      subscription.status === "inactive" &&
      new Date() <= subscription.gracePeriodEnd
    ) {
      subscription.status = "pending";
      await subscription.save();
      return this.createSubscriptionPayment(
        subscription.userId,
        subscription.planId,
        subscription.paymentMethod
      );
    }
    throw new Error("Subscription cannot be renewed");
  }

  async refund(txRef) {
    try {
      const transaction = await Transaction.findOne({
        flutterwaveTxRef: txRef,
      });
      if (transaction && transaction.status === "pending") {
        const refundResponse = await axios.post(
          `${FLUTTERWAVE_BASE_URL}/refunds`,
          { tx_ref: txRef },
          {
            headers: {
              Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            },
          }
        );
        if (refundResponse.data.status === "success") {
          transaction.status = "failed";
          await transaction.save();
        } else {
          console.error("Refund failed:", refundResponse.data);
        }
      }
    } catch (error) {
      console.error("Error processing refund:", error);
    }
  }
}

const paymentService = new PaymentService(); // Initialize PaymentService instance

module.exports = {
  createOneTimePayment,
  verifyOneTimePayment,
  paymentService, // Export the initialized PaymentService instance
};
