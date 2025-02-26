const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const paymentRoutes = require('./routes/payment');
const webhookRoutes = require('./routes/webhook');

const app = express();
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Routes
app.use('/payment', paymentRoutes);
app.use('/webhook', webhookRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
