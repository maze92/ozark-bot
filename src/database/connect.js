// src/database/connect.js
// ============================================================
// Conexão MongoDB (Mongoose)
// ------------------------------------------------------------
// Responsabilidades:
// - Ligar ao MongoDB
// - Logar estado da ligação
// - Atualizar o status global do bot (para /health)
//
// Estados monitorizados:
// - connected      → mongoConnected = true
// - disconnected   → mongoConnected = false
// - error          → mongoConnected = false
// - reconnected    → mongoConnected = true
// ============================================================

const mongoose = require('mongoose');
const status = require('../systems/status');

/**
 * Liga ao MongoDB
 * Aceita vários nomes de env para compatibilidade:
 * - MONGO_URI (recomendado)
 * - MONGODB_URI (muito comum em PM2 / Railway)
 */
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!uri) {
  console.error(
    '❌ Missing MongoDB URI. Set MONGO_URI (recommended) or MONGODB_URI in Railway/Env.'
  );

  // Se nem URI existe, garantimos que o health reflete isso
  status.setMongoConnected(false);
} else {
  mongoose
    .connect(uri)
    .then(() => {
      console.log('✅ MongoDB connected');
      status.setMongoConnected(true);
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err);
      status.setMongoConnected(false);
    });
}

/**
 * ------------------------------
 * Eventos do Mongoose
 * (mantêm o /health sempre correto)
 * ------------------------------
 */

// Ligação estabelecida
mongoose.connection.on('connected', () => {
  console.log('🟢 MongoDB connection established');
  status.setMongoConnected(true);
});

// Ligação perdida
mongoose.connection.on('disconnected', () => {
  console.warn('🟠 MongoDB disconnected');
  status.setMongoConnected(false);
});

// Erro de ligação
mongoose.connection.on('error', (err) => {
  console.error('🔴 MongoDB error:', err);
  status.setMongoConnected(false);
});

// Reconexão automática
mongoose.connection.on('reconnected', () => {
  console.log('🟢 MongoDB reconnected');
  status.setMongoConnected(true);
});

module.exports = mongoose;
