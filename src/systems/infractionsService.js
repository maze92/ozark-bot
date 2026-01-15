// src/systems/infractionsService.js
// ============================================================
// Service para criar infrações no MongoDB
// ============================================================

const Infraction = require('../database/models/Infraction'); // ✅ I maiúsculo

async function create({ guild, user, moderator, type, reason, duration = null }) {
  if (!guild?.id) return null;
  if (!user?.id) return null;
  if (!moderator?.id) return null;
  if (!type) return null;

  return Infraction.create({
    guildId: guild.id,
    userId: user.id,
    moderatorId: moderator.id,
    type,
    reason: reason || 'No reason provided',
    duration: duration ?? null
  });
}

module.exports = { create };
