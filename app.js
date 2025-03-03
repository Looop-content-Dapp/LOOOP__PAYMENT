const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { WebSocketServer } = require("ws");
const http = require("http");
const paymentRouter = require("./routes/payment");
const historyRouter = require("./routes/history");

dotenv.config();

const app = express();
app.use(express.json());

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Set up WebSocket server
const wss = new WebSocketServer({ server });

// Store connected clients by userId
const clients = new Map();

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("New WebSocket connection established");

  // Expect clients to send their userId upon connection
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { userId } = data;
      if (userId) {
        clients.set(userId, ws);
        console.log(`Client connected with userId: ${userId}`);
        ws.send(JSON.stringify({ status: "connected", userId }));
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    for (let [userId, client] of clients) {
      if (client === ws) {
        clients.delete(userId);
        console.log(`Client disconnected with userId: ${userId}`);
        break;
      }
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

// Function to broadcast transaction updates
const broadcastUpdate = (userId, update) => {
  const client = clients.get(userId);
  if (client && client.readyState === client.OPEN) {
    client.send(JSON.stringify(update));
  }
};

// Make broadcastUpdate available to other modules
module.exports = { broadcastUpdate };

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/payment", paymentRouter);
app.use("/history", historyRouter);

// Root route for health check
app.get("/", (req, res) => {
  res.send("Payment System API is running");
});

// Start server with error handling
const PORT = process.env.PORT || 8000;
server.listen(PORT, (err) => {
  if (err) {
    console.error("Error starting server:", err);
  } else {
    console.log(`Server running on port ${PORT}`);
  }
});
