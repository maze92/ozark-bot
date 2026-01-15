// src/database/connect.js
const mongoose = require('mongoose');

/**
 * Liga ao MongoDB
 * Aceita vários nomes de env para compatibilidade:
 * - MONGO_URI (recomendado)
 * - MONGODB_URI (muito comum em PM2 configs)
 */
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ Missing MongoDB URI. Set MONGO_URI (recommended) or MONGODB_URI in Railway/Env.');
} else {
  mongoose
    .connect(uri)
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));
}

module.exports = mongoose;
