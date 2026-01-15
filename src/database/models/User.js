// src/database/models/User.js
const { Schema, model } = require('mongoose');

/**
 * Guarda estado do utilizador na guild:
 * - warnings: contagem de avisos
 * - trust: reservado para uso futuro
 */
const userSchema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },

  warnings: { type: Number, default: 0 },
  trust: { type: Number, default: 30 }
}, { timestamps: true });

userSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = model('User', userSchema);

