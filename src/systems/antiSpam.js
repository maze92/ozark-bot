// src/systems/antiSpam.js

const { PermissionsBitField } = require('discord.js');
const config = require('../config/defaultConfig');

const infractionsService = require('./infractionsService');
const logger = require('./logger');
const warningsService = require('./warningsService');

function getTrustConfig() {
  const cfg = config.trust || {};

  return {
    enabled: cfg.enabled !== false,

    base: cfg.base ?? 30,
    min: cfg.min ?? 0,
    max: cfg.max ?? 100,

    lowThreshold: cfg.lowThreshold ?? 10,
    highThreshold: cfg.highThreshold ?? 60,

    lowTrustMessagesPenalty: cfg.lowTrustMessagesPenalty ?? 1,
    lowTrustMuteMultiplier: cfg.lowTrustMuteMultiplier ?? 1.5,
    highTrustMuteMultiplier: cfg.highTrustMuteMultiplier ?? 0.8
  };
}

function getEffectiveMaxMessages(baseMax, trustCfg, trustValue) {
  if (!trustCfg.enabled) return baseMax;

  const t = Number.isFinite(trustValue) ? trustValue : trustCfg.base;
  let effective = baseMax;

  if (t <= trustCfg.lowThreshold) {
    effective = Math.max(
      3,
      baseMax - trustCfg.lowTrustMessagesPenalty
    );
  }

  return effective;
}

function getEffectiveMuteDuration(baseMs, trustCfg, trustValue) {
  if (!trustCfg.enabled) return baseMs;

  const t = Number.isFinite(trustValue) ? trustValue : trustCfg.base;
  let duration = baseMs;

  if (t <= trustCfg.lowThreshold) {
    duration = Math.round(baseMs * trustCfg.lowTrustMuteMultiplier);
  } else if (t >= trustCfg.highThreshold) {
    duration = Math.round(baseMs * trustCfg.highTrustMuteMultiplier);
  }

  const MIN_MS = 30 * 1000;
  const MAX_MS = 28 * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(duration) || duration < MIN_MS) duration = MIN_MS;
  if (duration > MAX_MS) duration = MAX_MS;

  return duration;
}

const messageMap = new Map();

const CLEANUP_EVERY_MS = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of messageMap.entries()) {
    const lastTs = data?.timestamps?.[data.timestamps.length - 1];
    if (!lastTs || now - lastTs > 5 * 60_000) {
      messageMap.delete(key);
    }
  }
}, CLEANUP_EVERY_MS).unref?.();

module.exports = async function antiSpam(message, client) {
  try {
    if (!config.antiSpam?.enabled) return;
    if (!message?.guild) return;
    if (!message?.author || message.author.bot) return;
    if (!message?.member) return;

    const guild = message.guild;
    const botMember = guild.members.me;
    if (!botMember) return;

    const now = Date.now();
    const key = `${guild.id}:${message.author.id}`;

    const intervalMs = Number(config.antiSpam.interval ?? 7000);
    const maxMessages = Number(config.antiSpam.maxMessages ?? 6);
    const muteDurationMs = Number(config.antiSpam.muteDuration ?? 60_000);
    const actionCooldownMs = Number(config.antiSpam.actionCooldown ?? 60_000);

    const safeInterval = Number.isFinite(intervalMs) && intervalMs >= 500 ? intervalMs : 7000;
    const safeMaxBase = Number.isFinite(maxMessages) && maxMessages >= 3 ? maxMessages : 6;
    const safeMuteBase = Number.isFinite(muteDurationMs) && muteDurationMs >= 5_000 ? muteDurationMs : 60_000;
    const safeActionCooldown = Number.isFinite(actionCooldownMs) && actionCooldownMs >= 5_000
      ? actionCooldownMs
      : 60_000;

    const trustCfg = getTrustConfig();
    let trustValue = trustCfg.base;
    let dbUserBefore = null;

    try {
      dbUserBefore = await warningsService.getOrCreateUser(guild.id, message.author.id);
      if (dbUserBefore && Number.isFinite(dbUserBefore.trust)) {
        trustValue = dbUserBefore.trust;
      }
    } catch (e) {
      console.error('[antiSpam] warningsService.getOrCreateUser error:', e);
    }

    const effectiveMaxMessages = getEffectiveMaxMessages(
      safeMaxBase,
      trustCfg,
      trustValue
    );

    const bypassAdmins = config.antiSpam.bypassAdmins ?? true;
    if (bypassAdmins && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return;
    }

    if (Array.isArray(config.antiSpam.bypassRoles) && config.antiSpam.bypassRoles.length > 0) {
      const hasBypassRole = message.member.roles.cache.some(r =>
        config.antiSpam.bypassRoles.includes(r.id)
      );
      if (hasBypassRole) return;
    }

    if (message.member.roles.highest.position >= botMember.roles.highest.position) return;

    const perms = message.channel.permissionsFor(botMember);
    if (!perms?.has(PermissionsBitField.Flags.ModerateMembers)) return;

    const prev = messageMap.get(key);
    if (prev?.lastActionAt && now - prev.lastActionAt < safeActionCooldown) return;

    const data = prev || { timestamps: [], lastActionAt: 0 };

    data.timestamps = data.timestamps.filter(ts => now - ts < safeInterval);
    data.timestamps.push(now);

    messageMap.set(key, data);

    if (data.timestamps.length < effectiveMaxMessages) return;

    data.lastActionAt = now;
    data.timestamps = [];
    messageMap.set(key, data);

    if (!message.member.moderatable) return;

    const effectiveMute = getEffectiveMuteDuration(
      safeMuteBase,
      trustCfg,
      trustValue
    );

    await message.member.timeout(
      effectiveMute,
      'Spam detected (AntiSpam)'
    );

    if (config.antiSpam.sendMessage !== false) {
      await message.channel
        .send(`🔇 ${message.author} has been muted for spam.`)
        .catch(() => null);
    }

    let dbUserAfter = null;
    try {
      if (typeof warningsService.applyMutePenalty === 'function') {
        dbUserAfter = await warningsService.applyMutePenalty(guild.id, message.author.id);
      } else {
        dbUserAfter = await warningsService.getOrCreateUser(guild.id, message.author.id);
      }
    } catch (e) {
      console.error('[antiSpam] warningsService.applyMutePenalty error:', e);
    }

    const trustAfter = dbUserAfter?.trust ?? trustValue;

    await infractionsService.create({
      guild,
      user: message.author,
      moderator: client.user,
      type: 'MUTE',
      reason: 'Spam / Flood detected',
      duration: effectiveMute
    }).catch(() => null);

    await logger(
      client,
      'Anti-Spam Mute',
      message.author,
      client.user,
      `User muted for spam.\n` +
      `Duration: **${Math.round(effectiveMute / 1000)}s**\n` +
      `Threshold: **${effectiveMaxMessages} msgs / ${safeInterval}ms**\n` +
      (trustCfg.enabled
        ? `Trust after mute: **${trustAfter}/${trustCfg.max}**`
        : ''),
      guild
    );

  } catch (err) {
    console.error('[antiSpam] Error:', err);
  }
};
