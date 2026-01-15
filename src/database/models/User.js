// src/database/models/User.js

const { Schema, model } = require('mongoose');

/**
 * Esquema de utilizador por guild
 * 
 * Cada documento representa UM utilizador dentro de UMA guild específica.
 * O mesmo userId pode existir em várias guilds.
 */
const userSchema = new Schema(
  {
    // ID do utilizador no Discord
    userId: {
      type: String,
      required: true
    },

    // ID da guild (servidor Discord)
    guildId: {
      type: String,
      required: true
    },

    /**
     * Número de avisos ativos
     * - Incrementado pelo AutoMod ou warns manuais
     * - Pode ser resetado após mute ou manualmente
     */
    warnings: {
      type: Number,
      default: 0,
      min: 0
    },

    /**
     * Nível de confiança do utilizador
     * Pode ser usado para:
     * - Anti-raid
     * - Anti-spam
     * - Ajustar severidade da moderação
     */
    trust: {
      type: Number,
      default: 30,
      min: 0,
      max: 100
    }
  },
  {
    timestamps: true // createdAt e updatedAt automáticos
  }
);

/**
 * Índice composto:
 * - Garante que o mesmo utilizador só tem UM registo por guild
 * - Evita duplicados acidentais
 */
userSchema.index(
  { userId: 1, guildId: 1 },
  { unique: true }
);

/**
 * Exporta o modelo User
 * Usado em:
 * - autoModeration.js
 * - comandos (warn, clear, etc.)
 * - eventos (guildMemberAdd)
 */
module.exports = model('User', userSchema);
