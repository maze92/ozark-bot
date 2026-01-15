// src/database/models/GameNews.js
// ============================================================
// Model: GameNews
// Guarda o estado por feed RSS para evitar reposts.
//
// O que guarda:
// - source: nome do feed (único)
// - lastLink: link da última notícia enviada com sucesso
// ============================================================

const { Schema, model } = require('mongoose');

const gameNewsSchema = new Schema(
  {
    source: {
      type: String,
      required: true,
      unique: true
    },

    // Guarda o link do último item enviado
    lastLink: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = model('GameNews', gameNewsSchema);
