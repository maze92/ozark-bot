// src/services/discordFetchCache.js
//
// TTL cache + in-flight deduplication for Discord REST fetches.
// Keeps the bot responsive under load and reduces REST / rate-limit pressure.

/** @typedef {{ value: any, expiresAt: number }} CacheEntry */

const DEFAULTS = {
  channelTtlMs: 60_000,
  memberTtlMs: 30_000,
  guildTtlMs: 60_000,
};

/** @type {Map<string, CacheEntry>} */
const cache = new Map();

/** @type {Map<string, Promise<any>>} */
const inflight = new Map();

function now() {
  return Date.now();
}

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: now() + Math.max(0, ttlMs || 0) });
}

async function cached(key, ttlMs, fetcher) {
  const hit = getCache(key);
  if (hit) return hit;

  const running = inflight.get(key);
  if (running) return running;

  const p = (async () => {
    try {
      const v = await fetcher();
      if (v) setCache(key, v, ttlMs);
      return v || null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

function invalidatePrefix(prefix) {
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

async function fetchGuild(client, guildId, opts = {}) {
  const ttlMs = Number(opts.ttlMs ?? DEFAULTS.guildTtlMs);
  const key = `guild:${guildId}`;
  return cached(key, ttlMs, async () => {
    const g = client.guilds.cache.get(guildId) || null;
    if (g) return g;
    // guilds.fetch exists but requires privileged; keep safe.
    return null;
  });
}

async function fetchChannel(client, channelId, opts = {}) {
  const ttlMs = Number(opts.ttlMs ?? DEFAULTS.channelTtlMs);
  const key = `channel:${channelId}`;
  return cached(key, ttlMs, async () => {
    const c = client.channels.cache.get(channelId) || null;
    if (c) return c;
    return client.channels.fetch(channelId).catch(() => null);
  });
}

async function fetchMember(guild, userId, opts = {}) {
  const ttlMs = Number(opts.ttlMs ?? DEFAULTS.memberTtlMs);
  const key = `member:${guild.id}:${userId}`;
  return cached(key, ttlMs, async () => {
    const m = guild.members.cache.get(userId) || null;
    if (m) return m;
    return guild.members.fetch(userId).catch(() => null);
  });
}

module.exports = {
  fetchGuild,
  fetchChannel,
  fetchMember,
  invalidatePrefix,
  DEFAULTS,
};
