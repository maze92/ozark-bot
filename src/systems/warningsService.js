// src/systems/warningsService.js
// ============================================================
// Service de utilizadores (User model)
// ------------------------------------------------------------
// Responsabilidades:
// - getOrCreateUser
// - addWarning / resetWarnings
// - gestão centralizada de TRUST SCORE
//
// O trust NÃO deve ser alterado diretamente noutros sítios.
// AutoMod, comandos (!warn, !mute, etc) devem chamar este service.
//
// Trust logic:
// - WARN  → trust -= X
// - MUTE  → trust -= Y
// - sem infrações durante X dias → trust regenera (+1/dia)
//
// Isto garante:
// - regras consistentes
// - código limpo
// - fácil evolução futura
// ============================================================

const User = require('../database/models/User');
const config = require('../config/defaultConfig');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Lê config.trust com defaults seguros
 * (se não existir no config, funciona na mesma)
 */
function getTrustConfig() {
  const cfg = config.trust || {};

  return {
    enabled: cfg.enabled !== false,

    base: cfg.base ?? 30,
    min: cfg.min ?? 0,
    max: cfg.max ?? 100,

    warnPenalty: cfg.warnPenalty ?? 5,
    mutePenalty: cfg.mutePenalty ?? 15,

    regenPerDay: cfg.regenPerDay ?? 1,
    regenMaxDays: cfg.regenMaxDays ?? 30
  };
}

/**
 * Garante que o trust fica dentro dos limites
 */
function clampTrust(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Cria ou devolve utilizador
 */
async function getOrCreateUser(guildId, userId) {
  let u = await User.findOne({ guildId, userId });

  if (!u) {
    const trustCfg = getTrustConfig();

    u = await User.create({
      guildId,
      userId,
      warnings: 0,
      trust: trustCfg.base,
      lastInfractionAt: null,
      lastTrustUpdateAt: new Date()
    });
  }

  // garante defaults (compatibilidade com docs antigos)
  const trustCfg = getTrustConfig();

  if (!Number.isFinite(u.trust)) u.trust = trustCfg.base;
  if (!u.lastTrustUpdateAt) u.lastTrustUpdateAt = new Date();

  return u;
}

/**
 * Regenera trust com base no tempo sem infrações
 * (lazy update → só quando voltamos a tocar no user)
 */
function applyTrustRegen(u, trustCfg, now) {
  if (!trustCfg.enabled) return;

  const last =
    u.lastInfractionAt ||
    u.lastTrustUpdateAt ||
    u.createdAt ||
    now;

  const diffMs = now.getTime() - last.getTime();
  if (diffMs < DAY_MS) return;

  let days = Math.floor(diffMs / DAY_MS);
  if (days > trustCfg.regenMaxDays) {
    days = trustCfg.regenMaxDays;
  }

  const bonus = days * trustCfg.regenPerDay;
  if (bonus <= 0) return;

  u.trust = clampTrust(
    u.trust + bonus,
    trustCfg.min,
    trustCfg.max
  );

  u.lastTrustUpdateAt = now;
}

/**
 * Aplica penalização de trust
 * type: 'WARN' | 'MUTE'
 */
function applyTrustPenalty(u, trustCfg, type, now) {
  if (!trustCfg.enabled) return;

  let penalty = 0;
  if (type === 'WARN') penalty = trustCfg.warnPenalty;
  if (type === 'MUTE') penalty = trustCfg.mutePenalty;

  if (penalty > 0) {
    u.trust = clampTrust(
      u.trust - penalty,
      trustCfg.min,
      trustCfg.max
    );
  }

  u.lastInfractionAt = now;
  u.lastTrustUpdateAt = now;
}

/**
 * Adiciona warning ao utilizador
 * + atualiza trust (penalização WARN)
 */
async function addWarning(guildId, userId, amount = 1) {
  const trustCfg = getTrustConfig();
  const now = new Date();

  const u = await getOrCreateUser(guildId, userId);

  // 1) regenerar trust antes de penalizar
  applyTrustRegen(u, trustCfg, now);

  // 2) warnings
  u.warnings = (u.warnings || 0) + amount;

  // 3) penalização por WARN
  applyTrustPenalty(u, trustCfg, 'WARN', now);

  await u.save();
  return u;
}

/**
 * Aplica penalização de trust por MUTE
 * (não mexe em warnings)
 *
 * Deve ser chamado quando:
 * - AutoMod aplica timeout
 * - !mute manual é usado
 */
async function applyMutePenalty(guildId, userId) {
  const trustCfg = getTrustConfig();
  const now = new Date();

  const u = await getOrCreateUser(guildId, userId);

  // regeneração antes de penalizar
  applyTrustRegen(u, trustCfg, now);

  applyTrustPenalty(u, trustCfg, 'MUTE', now);

  await u.save();
  return u;
}

/**
 * Reset de warnings (ex: após mute)
 * NÃO altera trust
 */
async function resetWarnings(guildId, userId) {
  const u = await getOrCreateUser(guildId, userId);
  u.warnings = 0;
  await u.save();
  return u;
}

module.exports = {
  getOrCreateUser,
  addWarning,
  resetWarnings,
  applyMutePenalty
};
