const Flutterwave = require("flutterwave-node-v3");
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY
);
const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const Transaction = require("../models/Transaction");
const { calculateUSDC, generateClaimToken } = require("./blockchainService");

class PaymentService {
  // Create a payment plan for an artist's tribe
  async createPaymentPlan(artistId, tribeId, name, amount, description) {
    const planData = {
      name: `${name} - ${tribeId}`,
      amount,
      interval: "monthly", // Monthly billing
      currency: "USD",
    };

    const response = await flw.PaymentPlan.create(planData);
    if (response.status === "success") {
      const plan = await Plan.create({
        artistId,
        tribeId,
        name,
        amount,
        description,
        flutterwavePlanId: response.data.id,
      });
      return plan;
    }
    throw new Error("Failed to create payment plan");
  }

  // Subscribe a user to an artist's plan
  async createSubscriptionPayment(userId, planId, paymentMethod) {
    const plan = await Plan.findById(planId);
    if (!plan) throw new Error("Plan not found");

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
      card_number: "5531886652142950",
      expiry_month: "09",
      expiry_year: "32",
      cvv: "564",
      tx_ref: txRef,
      amount: plan.amount,
      email: `${userId}@example.com`,
      currency: "USD",
      redirect_url: "http://localhost:8000/payment/callback",
      meta: { subscriptionId: subscription._id },
      payment_plan: plan.flutterwavePlanId,
      enckey: process.env.FLW_ENCRYPTION_KEY || "FLWSECK_TEST1363c232db07",
    };

    const response = await flw.Charge.card(paymentData);
    if (response.status === "success") {
      return {
        paymentLink: response.data.link,
        subscriptionId: subscription._id,
        txRef,
      };
    }
    throw new Error("Payment initiation failed");
  }

  // Verify Payment and Activate Subscription
  async verifyPayment(txRef) {
    const response = await flw.Transaction.verify({ id: txRef });
    if (response.status === "success") {
      const transaction = await Transaction.create({
        userId: response.data.customer.email.split("@")[0],
        amount: response.data.amount,
        currency: response.data.currency,
        transactionHash: response.data.tx_ref,
        status: "success",
        paymentMethod: response.data.payment_type,
        flutterwaveTxRef: txRef,
      });

      if (response.data.meta?.subscriptionId) {
        const subscription = await Subscription.findById(
          response.data.meta.subscriptionId
        );
        subscription.status = "active";
        subscription.flutterwaveSubscriptionId =
          response.data.payment_plan?.subscription_id || txRef; // Fallback to txRef if no subscription ID
        await subscription.save();

        const usdcEquivalent = await calculateUSDC(response.data.amount);
        transaction.usdcEquivalent = usdcEquivalent;
        await transaction.save();

        const claimToken = await generateClaimToken(
          transaction._id,
          usdcEquivalent
        );
        return { transaction, claimToken, subscription };
      }
      return { transaction };
    }
    throw new Error("Payment verification failed");
  }

  // Cancel Subscription
  async cancelSubscription(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (subscription.flutterwaveSubscriptionId) {
      await flw.Subscription.cancel({
        id: subscription.flutterwaveSubscriptionId,
      });
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

  // One-Time Payment (Unchanged)
  async createOneTimePayment(userId, amount, paymentMethod) {
    const txRef = `one_${Date.now()}`;
    const paymentData = {
      tx_ref: txRef,
      amount,
      currency: "USD",
      payment_options: paymentMethod === "applepay" ? "applepay" : "card",
      customer: { email: `${userId}@example.com` },
      redirect_url: "http://localhost:3000/payment/callback",
    };

    const response = await flw.Charge.card(paymentData);
    return { paymentLink: response.data.link, txRef };
  }
}

module.exports = new PaymentService();
