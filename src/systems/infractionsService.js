// src/systems/infractionsService.js
// ============================================================
// Service para registar infrações no MongoDB
//
// O que faz:
// - Centraliza a criação de infrações (WARN / MUTE / KICK / BAN)
// - Evita "requires" confusos (infraction vs infractions)
// - Dá funções utilitárias para consultar infrações (opcional)
//
// Porque existe:
// - Para que AutoMod / AntiSpam / comandos (warn/mute) registem sempre
//   da mesma forma, num único sítio.
// ============================================================

const Infraction = require('../database/models/infraction');

// Tipos válidos (mantém alinhado com o enum do model)
const VALID_TYPES = new Set(['WARN', 'MUTE', 'KICK', 'BAN']);

// Limite simples para não encher BD com reasons gigantes
const MAX_REASON_LENGTH = 512;

/**
 * Normaliza o tipo recebido para o formato esperado pela BD.
 * @param {string} type
 * @returns {'WARN'|'MUTE'|'KICK'|'BAN'|null}
 */
function normalizeType(type) {
  if (!type) return null;
  const t = String(type).trim().toUpperCase();
  return VALID_TYPES.has(t) ? t : null;
}

/**
 * Normaliza/limita o motivo.
 * @param {string} reason
 * @returns {string}
 */
function normalizeReason(reason) {
  const r = String(reason || 'No reason provided').trim();
  if (!r) return 'No reason provided';
  return r.length > MAX_REASON_LENGTH ? r.slice(0, MAX_REASON_LENGTH) : r;
}

/**
 * Cria uma infração no MongoDB.
 *
 * @param {Object} params
 * @param {Guild} params.guild               - Guild onde aconteceu
 * @param {User} params.user                 - Utilizador afetado
 * @param {User} params.moderator            - Moderador / bot que aplicou
 * @param {'WARN'|'MUTE'|'KICK'|'BAN'|string} params.type
 * @param {string} [params.reason]
 * @param {number|null} [params.duration]    - em ms (apenas para MUTE)
 *
 * @returns {Promise<Object|null>} Documento criado (ou null se falhar)
 */
async function create({ guild, user, moderator, type, reason, duration = null }) {
  try {
    // ------------------------------
    // Validações mínimas
    // ------------------------------
    if (!guild?.id) return null;
    if (!user?.id) return null;
    if (!moderator?.id) return null;

    const normalizedType = normalizeType(type);
    if (!normalizedType) return null;

    const normalizedReason = normalizeReason(reason);

    // Duration só faz sentido no MUTE (timeout)
    const safeDuration =
      normalizedType === 'MUTE' && Number.isFinite(Number(duration)) && Number(duration) > 0
        ? Number(duration)
        : null;

    // ------------------------------
    // Criação do documento na BD
    // ------------------------------
    const doc = await Infraction.create({
      guildId: guild.id,
      userId: user.id,
      moderatorId: moderator.id,
      type: normalizedType,
      reason: normalizedReason,
      duration: safeDuration
    });

    return doc;
  } catch (err) {
    // Não rebenta o bot se a BD falhar
    console.error('[infractionsService.create] Error:', err?.message || err);
    return null;
  }
}

/**
 * Lista infrações de um utilizador numa guild.
 * (Útil se no futuro quiseres comando/página de histórico)
 *
 * @param {Object} params
 * @param {string} params.guildId
 * @param {string} params.userId
 * @param {number} [params.limit=20]
 * @returns {Promise<Array>}
 */
async function listByUser({ guildId, userId, limit = 20 }) {
  try {
    if (!guildId || !userId) return [];
    const lim = Math.max(1, Math.min(Number(limit) || 20, 100));

    return await Infraction.find({ guildId, userId })
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();
  } catch (err) {
    console.error('[infractionsService.listByUser] Error:', err?.message || err);
    return [];
  }
}

/**
 * Lista infrações recentes de uma guild.
 * (Perfeito para alimentar dashboard futuramente)
 *
 * @param {Object} params
 * @param {string} params.guildId
 * @param {number} [params.limit=50]
 * @returns {Promise<Array>}
 */
async function listRecentByGuild({ guildId, limit = 50 }) {
  try {
    if (!guildId) return [];
    const lim = Math.max(1, Math.min(Number(limit) || 50, 200));

    return await Infraction.find({ guildId })
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();
  } catch (err) {
    console.error('[infractionsService.listRecentByGuild] Error:', err?.message || err);
    return [];
  }
}

module.exports = {
  create,
  listByUser,
  listRecentByGuild
};
