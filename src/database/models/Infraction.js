// src/database/models/Infraction.js

const { Schema, model } = require('mongoose');

const infractionSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },

  type: {
    type: String,
    enum: ['WARN', 'MUTE', 'KICK', 'BAN'],
    required: true
  },

  reason: { type: String, default: 'No reason provided' },

  duration: { type: Number, default: null }
}, { timestamps: true });

infractionSchema.index({ guildId: 1, userId: 1, createdAt: -1 });

module.exports = model('Infraction', infractionSchema);

