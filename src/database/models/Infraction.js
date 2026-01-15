// src/database/models/Infraction.js
const { Schema, model } = require('mongoose');

/**
 * Esquema para armazenar infrações de usuários
 * Pode registrar warns, mutes, kicks e bans
 */
const infractionSchema = new Schema({
  guildId: {
    type: String,
    required: true, // ID da guilda onde a infração ocorreu
  },
  userId: {
    type: String,
    required: true, // ID do usuário que recebeu a infração
  },
  moderatorId: {
    type: String,
    required: true, // ID do moderador que aplicou a infração
  },
  type: {
    type: String,
    enum: ['WARN', 'MUTE', 'KICK', 'BAN'], // Tipo de infração permitido
    required: true,
  },
  reason: {
    type: String,
    default: 'No reason provided', // Motivo da infração
  },
  duration: {
    type: Number, // Apenas para mutes: duração em ms
    default: null,
  }
}, {
  timestamps: true // Adiciona automaticamente createdAt e updatedAt
});

// Exporta o modelo para ser usado no sistema
module.exports = model('Infraction', infractionSchema);
