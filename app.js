const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const paymentRoutes = require("./routes/payment");
const webhookRoutes = require("./routes/webhook");

const app = express();
app.use(express.json());

const mongoURI =
  process.env.NODE_ENV !== "production"
    ? "mongodb://localhost:27017/"
    : process.env.MONGODB_URI || "";

const PORT = process.env.PORT || 8000;

// MongoDB Connection
mongoose.connect(mongoURI);

mongoose.connection.on("open", () => {
  console.log("Connected to MongoDB successfully.");
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});

mongoose.connection.on("error", (err) => {
  console.error(`MongoDB connection error: ${err}`);
  process.exit(1);
});

// Routes
app.use("/payment", paymentRoutes);
app.use("/webhook", webhookRoutes);
