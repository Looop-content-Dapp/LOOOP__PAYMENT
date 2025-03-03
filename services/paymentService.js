const Flutterwave = require('flutterwave-node-v3');
const Transaction = require('../models/Transaction');
const BlockchainService = require('./BlockchainService');
const { Plan } = require('../models/plan.model');
const { Subscription } = require('../models/subscription.model');

const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

class PaymentService {
//Create a payment plan for an artist's tribe
  async createPaymentPlan(artistId, tribeId, name, amount, description) {
    const planData = {
      name: `${name} - ${tribeId}`,
      amount,
      interval: "monthly", // Monthly billing
      currency: "USD" || "NGN",
    };

    const response = await flw.PaymentPlan.create(planData);

    console.log("plan created successfully!");
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
    throw new Error("fail to create a payment plan!");
  }
  //Create a payment plan for an artist's tribe
  async createPaymentPlan(artistId, tribeId, name, amount, description) {
    const planData = {
      name: `${name} - ${tribeId}`,
      amount,
      interval: "monthly", // Monthly billing
      currency: "USD" || "NGN",
    };
    const response = await flw.PaymentPlan.create(planData);
    console.log("plan created successfully!");
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
      customer: { email: `${userId}@example.com` }, //customer email will be here
      redirect_url: "http://localhost:8000/payment/callback",
      meta: { subscriptionId: subscription._id },
      payment_plan: plan.flutterwavePlanId, // Link to Flutterwave plan
    };
    const response = await flw.Charge.card(paymentData);
    if (response.status === "success") {
      return {
        paymentLink: response.data.link,
        subscriptionId: subscription._id,
        txRef,
      };
    }
    throw new Error("Payment initiation failed!");
  }
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
        console.log("token created here");
      }
      return { transaction };
    }
    throw new Error("Payment verification failed");
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
      customer: { email: `${userId}@example.com` }, //customer email will be here
      redirect_url: "http://localhost:8000/payment/callback",
      meta: { subscriptionId: subscription._id },
      payment_plan: plan.flutterwavePlanId, // Link to Flutterwave plan
    };

    const response = await flw.Charge.card(paymentData);
    if (response.status === "success") {
      return {
        paymentLink: response.data.link,
        subscriptionId: subscription._id,
        txRef,
      };
    }
    throw new Error("Payment initiation failed!");
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

  async createOneTimePayment(userId, amount, paymentMethod, walletAddress, blockchain) {
    try {
      const txRef = `one_${Date.now()}`;
      const paymentData = {
        tx_ref: txRef,
        amount,
        currency: 'USD',
        payment_options: paymentMethod === 'applepay' ? 'applepay' : 'card',
        customer: { email: `${userId}@example.com` },
        redirect_url: `http://localhost:${process.env.PORT || 8000}/payment/callback`,
        meta: { walletAddress, blockchain },
      };

      const response = await flw.Charge.card(paymentData);
      if (response.status === 'success') {
        await Transaction.create({
          userId,
          amount,
          currency: 'USD',
          usdcEquivalent: 0,
          transactionHash: '',
          status: 'pending',
          paymentMethod,
          flutterwaveTxRef: txRef,
          blockchain,
          title: `Funding wallet on ${blockchain}`,
          message: 'From card',
        });
        return { paymentLink: response.data.link, txRef };
      }
      throw new Error('Payment initiation failed');
    } catch (error) {
      console.error('Error creating one-time payment:', error);
      throw error;
    }
  }

  async verifyOneTimePayment(txRef) {
    try {
      const response = await flw.Transaction.verify({ id: txRef });
      if (response.status === 'success') {
        const { walletAddress, blockchain } = response.data.meta;
        const usdcEquivalent = await BlockchainService.calculateUSDC(response.data.amount);

        try {
          const transferResult = await BlockchainService.transferUSDC(
            blockchain,
            walletAddress,
            usdcEquivalent
          );
          await Transaction.findOneAndUpdate(
            { flutterwaveTxRef: txRef },
            {
              usdcEquivalent,
              transactionHash: transferResult.txHash,
              status: 'success',
              title: `Funded wallet on ${blockchain}`,
              message: 'From card',
            },
            { new: true }
          );
        } catch (error) {
          console.error('Token transfer failed:', error);
          await this.refund(txRef);
          throw new Error('Token transfer failed, refund initiated');
        }
        return { transaction: await Transaction.findOne({ flutterwaveTxRef: txRef }) };
      }
      throw new Error('Payment verification failed');
    } catch (error) {
      console.error('Error verifying one-time payment:', error);
      throw error;
    }
  }

  async refund(txRef) {
    try {
      const transaction = await Transaction.findOne({ flutterwaveTxRef: txRef });
      if (transaction && transaction.status === 'pending') {
        const refundResponse = await flw.Refund.create({ tx_ref: txRef });
        if (refundResponse.status === 'success') {
          transaction.status = 'failed';
          await transaction.save();
        } else {
          console.error('Refund failed:', refundResponse);
        }
      }
    } catch (error) {
      console.error('Error processing refund:', error);
    }
  }
}

module.exports = new PaymentService();
