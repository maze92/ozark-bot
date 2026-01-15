// src/systems/cooldowns.js
// ============================================================
// Cooldowns por comando e utilizador
// Retorna:
// - null -> pode executar
// - "X.X" -> bloqueado (segundos restantes)
// ============================================================

const config = require('../config/defaultConfig');

// Map<commandName, Map<userId, lastUsedMs>>
const cooldowns = new Map();

module.exports = function checkCooldown(commandName, userId) {
  const now = Date.now();

  const commandCooldown =
    config.cooldowns?.[commandName] ??
    config.cooldowns?.default ??
    3000;

  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }

  const timestamps = cooldowns.get(commandName);

  if (timestamps.has(userId)) {
    const lastUsed = timestamps.get(userId);
    const expiration = lastUsed + commandCooldown;

    if (now < expiration) {
      return ((expiration - now) / 1000).toFixed(1);
    }
  }

  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), commandCooldown).unref?.();

  return null;
};
