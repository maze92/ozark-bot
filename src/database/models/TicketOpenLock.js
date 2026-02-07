// src/database/models/TicketOpenLock.js
// Short-lived lock to prevent duplicate ticket thread creation

const mongoose = require('mongoose');

const TicketOpenLockSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    // TTL handled via `expires` to avoid duplicate schema index warnings.
    createdAt: { type: Date, default: Date.now, expires: 45 }
  },
  { versionKey: false }
);

// Only one lock per (guildId,userId) at a time
TicketOpenLockSchema.index({ guildId: 1, userId: 1 }, { unique: true });
// Auto-expire locks after 45 seconds (see `expires` field on createdAt)

module.exports = mongoose.models.TicketOpenLock || mongoose.model('TicketOpenLock', TicketOpenLockSchema);
