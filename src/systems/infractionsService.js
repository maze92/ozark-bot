// src/systems/infractionsService.js
// ============================================================
// Service para registar infrações no MongoDB
// - Centraliza criação (WARN/MUTE/KICK/BAN)
// - Evita requires confusos (infraction vs infractions)
// ============================================================

const Infraction = require('../database/models/infraction');

/**
 * Cria uma infração no MongoDB
 * @param {Object} params
 * @param {Guild} params.guild
 * @param {User} params.user
 * @param {User} params.moderator
 * @param {'WARN'|'MUTE'|'KICK'|'BAN'} params.type
 * @param {string} params.reason
 * @param {number|null} params.duration
 */
async function create({ guild, user, moderator, type, reason, duration = null }) {
  if (!guild?.id) return null;
  if (!user?.id) return null;
  if (!moderator?.id) return null;
  if (!type) return null;

  const doc = await Infraction.create({
    guildId: guild.id,
    userId: user.id,
    moderatorId: moderator.id,
    type,
    reason: reason || 'No reason provided',
    duration: duration ?? null
  });

  return doc;
}

module.exports = {
  create
};
