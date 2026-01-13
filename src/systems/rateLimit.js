const cooldowns = new Map();

/**
 * Simple per-user command rate limit
 * @param {string} userId
 * @param {string} commandName
 * @param {number} cooldownMs
 * @returns {boolean} true = blocked
 */
module.exports = function rateLimit(userId, commandName, cooldownMs = 3000) {
  const key = `${userId}:${commandName}`;
  const now = Date.now();

  const expires = cooldowns.get(key);
  if (expires && now < expires) {
    return true;
  }

  cooldowns.set(key, now + cooldownMs);
  return false;
};
