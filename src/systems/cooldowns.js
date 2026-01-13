const config = require('../config/defaultConfig');

const cooldowns = new Map();

module.exports = function checkCooldown(commandName, userId) {
  const now = Date.now();
  const commandCooldown =
    config.cooldowns?.[commandName] ?? config.cooldowns.default;

  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }

  const timestamps = cooldowns.get(commandName);

  if (timestamps.has(userId)) {
    const expiration = timestamps.get(userId) + commandCooldown;

    if (now < expiration) {
      const remaining = ((expiration - now) / 1000).toFixed(1);
      return remaining;
    }
  }

  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), commandCooldown);

  return null;
};
