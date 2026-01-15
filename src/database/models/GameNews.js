// src/database/models/GameNews.js
const { Schema, model } = require('mongoose');

/**
 * Esquema para armazenar estado do sistema GameNews por feed
 * Agora suporta:
 * - dedupe real (lista de hashes recentes)
 * - backoff (pausa feed após erros seguidos)
 */
const gameNewsSchema = new Schema(
  {
    // Nome do feed (ex: "GameSpot/News")
    source: {
      type: String,
      required: true,
      unique: true
    },

    /**
     * Lista de hashes das últimas notícias enviadas para este feed
     * - Serve para dedupe real (evita repetidos mesmo com reordenação do RSS)
     * - Mantemos apenas os últimos N (ex: 10-20)
     */
    lastHashes: {
      type: [String],
      default: []
    },

    /**
     * Contador de erros consecutivos do feed
     * - Se atingir o limite, ativamos pausa/backoff
     */
    failCount: {
      type: Number,
      default: 0
    },

    /**
     * Se definido, o feed fica “pausado” até esta data
     * - usado para backoff quando o feed falha muitas vezes
     */
    pausedUntil: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = model('GameNews', gameNewsSchema);
