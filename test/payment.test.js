const request = require("supertest");
const { expect } = require("chai");
const app = require("../app"); // Adjust the path to your app.js file

describe("Payment API", () => {
  describe("POST /payment/fund-wallet", () => {
    it("should create a one-time payment successfully", async () => {
      const response = await request(app).post("/payment/fund-wallet").send({
        userId: "test@example.com", // Replace with a valid user ID or email
        amount: 100, // Amount to be charged
        paymentMethod: "card", // Payment method
        walletAddress: "0x1234567890abcdef", // Example wallet address
        blockchain: "Ethereum", // Example blockchain
      });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("status", "success"); // Adjust based on your API response
      expect(response.body).to.have.property("data"); // Check if data is returned
    });

    it("should return an error for missing required fields", async () => {
      const response = await request(app).post("/payment/fund-wallet").send({
        userId: "test@example.com", // Missing amount, paymentMethod, walletAddress, blockchain
      });

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property(
        "error",
        "Missing required fields"
      );
    });

    it("should return an error for invalid blockchain", async () => {
      const response = await request(app).post("/payment/fund-wallet").send({
        userId: "test@example.com",
        amount: 100,
        paymentMethod: "card",
        walletAddress: "0x1234567890abcdef",
        blockchain: "InvalidBlockchain", // Invalid blockchain
      });

      expect(response.status).to.equal(500);
      expect(response.body)
        .to.have.property("error")
        .that.includes("Invalid blockchain specified");
    });
  });
});
