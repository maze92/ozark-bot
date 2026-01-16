// src/database/models/GameNews.js
const { Schema, model } = require('mongoose');

/**
 * Guarda estado por FEED de RSS:
 * - lastHashes: dedupe real (últimos N hashes)
 * - failCount: falhas consecutivas (para backoff)
 * - pausedUntil: pausa o feed quando falha demasiado
 * - lastSentAt: último envio com sucesso
 */
const gameNewsSchema = new Schema(
  {
    source: {
      type: String,
      required: true,
      unique: true
    },

    // ✅ Dedupe real: últimos N hashes
    lastHashes: {
      type: [String],
      default: []
    },

    // ✅ Backoff
    failCount: {
      type: Number,
      default: 0
    },
    pausedUntil: {
      type: Date,
      default: null
    },

    // ✅ Último envio bem sucedido
    lastSentAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = model('GameNews', gameNewsSchema);

