// src/systems/warningsService.js

const User = require('../database/models/User');
const config = require('../config/defaultConfig');

const DAY_MS = 24 * 60 * 60 * 1000;

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

function clampTrust(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

async function getOrCreateUser(guildId, userId) {
  let u = await User.findOne({ guildId, userId });
  const trustCfg = getTrustConfig();
  const now = new Date();

  // Criar registo novo com trust base
  if (!u) {
    u = await User.create({
      guildId,
      userId,
      warnings: 0,
      trust: trustCfg.base,
      lastInfractionAt: null,
      lastTrustUpdateAt: now
    });
    return u;
  }

  // Normalizações
  if (!Number.isFinite(u.trust)) u.trust = trustCfg.base;
  if (!u.lastTrustUpdateAt) u.lastTrustUpdateAt = u.createdAt || now;

  // ✅ Aplicar regen aqui, para qualquer uso do warningsService
  const beforeTrust = u.trust;
  const beforeLastUpdate =
    u.lastTrustUpdateAt && typeof u.lastTrustUpdateAt.getTime === 'function'
      ? u.lastTrustUpdateAt.getTime()
      : 0;

  applyTrustRegen(u, trustCfg, now);

  const afterLastUpdate =
    u.lastTrustUpdateAt && typeof u.lastTrustUpdateAt.getTime === 'function'
      ? u.lastTrustUpdateAt.getTime()
      : 0;

  // Só gravar se algo mudou (evita spam na DB)
  if (u.trust !== beforeTrust || afterLastUpdate !== beforeLastUpdate) {
    await u.save().catch(() => null);
  }

  return u;
}

async function addWarning(guildId, userId, amount = 1) {
  const trustCfg = getTrustConfig();
  const now = new Date();

  const u = await getOrCreateUser(guildId, userId);

  u.warnings = (u.warnings || 0) + amount;

  applyTrustPenalty(u, trustCfg, 'WARN', now);

  await u.save();
  return u;
}

async function applyMutePenalty(guildId, userId) {
  const trustCfg = getTrustConfig();
  const now = new Date();

  const u = await getOrCreateUser(guildId, userId);

  applyTrustPenalty(u, trustCfg, 'MUTE', now);

  await u.save();
  return u;
}

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
