// src/systems/autoModeration.js

const { PermissionsBitField } = require('discord.js');
const config = require('../config/defaultConfig');

const logger = require('./logger');
const warningsService = require('./warningsService');
const infractionsService = require('./infractionsService');

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
    regenMaxDays: cfg.regenMaxDays ?? 30,

    lowThreshold: cfg.lowThreshold ?? 10,
    highThreshold: cfg.highThreshold ?? 60,

    lowTrustWarningsPenalty: cfg.lowTrustWarningsPenalty ?? 1,
    lowTrustMessagesPenalty: cfg.lowTrustMessagesPenalty ?? 1,

    lowTrustMuteMultiplier: cfg.lowTrustMuteMultiplier ?? 1.5,
    highTrustMuteMultiplier: cfg.highTrustMuteMultiplier ?? 0.8
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getEffectiveWarningsLimit(baseMaxWarnings, trustCfg, trustValue) {
  if (!trustCfg.enabled) return baseMaxWarnings;

  const t = Number.isFinite(trustValue) ? trustValue : trustCfg.base;

  let effective = baseMaxWarnings;

  if (t <= trustCfg.lowThreshold) {
    effective = baseMaxWarnings - (trustCfg.lowTrustWarningsPenalty || 1);
  }

  if (effective < 1) effective = 1;
  return effective;
}

function getEffectiveMuteDuration(baseMuteMs, trustCfg, trustValue) {
  if (!trustCfg.enabled) return baseMuteMs;

  const t = Number.isFinite(trustValue) ? trustValue : trustCfg.base;

  let multiplier = 1;

  if (t <= trustCfg.lowThreshold) {
    multiplier = trustCfg.lowTrustMuteMultiplier ?? 1.5;
  } else if (t >= trustCfg.highThreshold) {
    multiplier = trustCfg.highTrustMuteMultiplier ?? 0.8;
  }

  let duration = baseMuteMs * multiplier;

  const MIN_MS = 60 * 1000;
  const MAX_MS = 28 * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(duration) || duration < MIN_MS) duration = MIN_MS;
  if (duration > MAX_MS) duration = MAX_MS;

  return duration;
}

function buildWarnChannelMessage({ userMention, warnings, maxWarnings, trustText }) {
  return (
    `⚠️ ${userMention}, you received a **WARN**.\n` +
    `📝 Reason: **Inappropriate language**\n` +
    `📌 Warnings: **${warnings}/${maxWarnings}**` +
    (trustText ? `\n${trustText}` : '')
  );
}

function buildWarnDMMessage({ guildName, reason, warnings, maxWarnings, trustText }) {
  return (
    `⚠️ You received a **WARN** in **${guildName}**.\n` +
    `📝 Reason: **${reason}**\n` +
    `📌 Warnings: **${warnings}/${maxWarnings}**` +
    (trustText ? `\n${trustText}` : '')
  );
}

function buildMuteChannelMessage({ userMention, minutes, reason, trustText }) {
  return (
    `🔇 ${userMention} has been **muted**.\n` +
    `⏱️ Duration: **${minutes} minutes**\n` +
    `📝 Reason: **${reason}**` +
    (trustText ? `\n${trustText}` : '')
  );
}

function buildMuteDMMessage({ guildName, minutes, reason, trustText }) {
  return (
    `🔇 You have been **muted** in **${guildName}**.\n` +
    `⏱️ Duration: **${minutes} minutes**\n` +
    `📝 Reason: **${reason}**` +
    (trustText ? `\n${trustText}` : '')
  );
}

async function trySendDM(user, content) {
  try {
    if (!user) return;
    if (!content) return;
    await user.send({ content }).catch(() => null);
  } catch {
  }
}

function minutesFromMs(ms) {
  if (!Number.isFinite(ms)) return 0;
  return Math.round(ms / 60000);
}

function isStaff(member) {
  if (!member) return false;

  const isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator);
  if (isAdmin) return true;

  const staffRoles = Array.isArray(config.staffRoles) ? config.staffRoles : [];
  if (!staffRoles.length) return false;

  return member.roles?.cache?.some((r) => staffRoles.includes(r.id));
}

function getLanguageBannedWords(language) {
  const bannedWords = config.bannedWords || {};

  const langWords = bannedWords[language] || bannedWords.en || [];
  const allWords = Array.isArray(bannedWords.all) ? bannedWords.all : [];

  const merged = [...langWords, ...allWords].map((w) => String(w || '').trim().toLowerCase());
  return Array.from(new Set(merged.filter(Boolean)));
}

function findBannedWordInContent(content, language) {
  if (!content || typeof content !== 'string') return null;

  const words = getLanguageBannedWords(language);
  if (!words.length) return null;

  const lower = content.toLowerCase();

  for (const banned of words) {
    if (!banned) continue;

    if (lower.includes(banned)) {
      return banned;
    }
  }

  return null;
}

module.exports = async (message, client) => {
  try {
    if (!message?.guild) return;
    if (!message.member) return;

    if (message.author.bot) return;

    const guild = message.guild;
    const botMember = guild.members.me;
    if (!botMember) return;

    if (!message.content || typeof message.content !== 'string') return;

    const baseCfg = config.autoModeration || {};
    if (baseCfg.enabled === false) return;

    if (message.channel?.isDMBased?.() || message.channel?.type === 1) return;

    const perms = message.channel.permissionsFor(botMember);
    if (!perms?.has(PermissionsBitField.Flags.ManageMessages)) return;

    const channelCfg = (baseCfg.channels && baseCfg.channels[message.channel.id]) || null;
    const language = (channelCfg && channelCfg.language) || config.language || 'en';

    const foundWord = findBannedWordInContent(message.content, language);
    if (!foundWord) return;

    const member = message.member;

    const exemptRoles = Array.isArray(baseCfg.exemptRoles) ? baseCfg.exemptRoles : [];
    if (exemptRoles.length && member.roles.cache.some((r) => exemptRoles.includes(r.id))) {
      return;
    }

    const trustCfg = getTrustConfig();

    const dbUser = await warningsService.getOrCreateUser(guild.id, message.author.id);

    const currentTrust = trustCfg.enabled
      ? clamp(
          dbUser?.trust ?? trustCfg.base,
          trustCfg.min,
          trustCfg.max
        )
      : trustCfg.base;

    const baseMaxWarnings = Number(baseCfg.maxWarnings ?? 3);
    const effectiveMaxWarnings = getEffectiveWarningsLimit(
      baseMaxWarnings,
      trustCfg,
      currentTrust
    );

    let canDelete = true;
    try {
      await message.delete().catch((err) => {
        canDelete = false;
        if (err?.code !== 10008) {
          console.error('[AutoMod] Failed to delete message:', err);
        }
      });
    } catch (err) {
      canDelete = false;
      console.error('[AutoMod] Fatal error deleting message:', err);
    }

    const updatedUser = await warningsService.addWarning(guild.id, message.author.id, 1);
    const trustAfterWarn = trustCfg.enabled
      ? clamp(
          updatedUser?.trust ?? trustCfg.base,
          trustCfg.min,
          trustCfg.max
        )
      : updatedUser?.trust ?? trustCfg.base;

    await infractionsService
      .create({
        guild,
        user: message.author,
        moderator: client.user,
        type: 'WARN',
        reason: `AutoMod detected banned word: ${foundWord}`,
        duration: null
      })
      .catch(() => null);

    const trustLine = trustCfg.enabled ? `🔐 Trust: **${currentTrust}/${trustCfg.max}**` : '';

    await message.channel
      .send({
        content: buildWarnChannelMessage({
          userMention: `${message.author}`,
          warnings: updatedUser.warnings,
          maxWarnings: effectiveMaxWarnings,
          trustText: '' // NÃO mostrar trust ao utilizador
        })
      })
      .catch(() => null);

    if (config.notifications?.dmOnWarn) {
      const dmText = buildWarnDMMessage({
        guildName: guild.name,
        reason: `Inappropriate language (detected: "${foundWord}")`,
        warnings: updatedUser.warnings,
        maxWarnings: effectiveMaxWarnings,
        trustText: '' // NÃO mostrar trust em DM
      });

      await trySendDM(message.author, dmText);
    }

    await logger(
      client,
      'Automatic Warn',
      message.author,
      client.user,
      `Word: **${foundWord}**\n` +
        `Warnings: **${updatedUser.warnings}/${effectiveMaxWarnings}**\n` +
        (trustCfg.enabled ? `Trust: **${currentTrust}/${trustCfg.max}**\n` : '') +
        `Deleted: **${canDelete ? 'yes' : 'no'}**`,
      guild
    );

    if (updatedUser.warnings < effectiveMaxWarnings) {
      return;
    }

    if (!perms.has(PermissionsBitField.Flags.ModerateMembers)) return;

    const canTimeout =
      typeof member.isCommunicationDisabled === 'function'
        ? !member.isCommunicationDisabled()
        : true;

    if (!canTimeout) {
      return;
    }

    const executorIsStaff = isStaff(message.member);
    if (!executorIsStaff && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return;
    }

    const baseMuteMs = Number(baseCfg.muteDuration ?? 10 * 60 * 1000);
    const effectiveMute = getEffectiveMuteDuration(baseMuteMs, trustCfg, trustAfterWarn);
    const mins = minutesFromMs(effectiveMute);

    await message.member.timeout(
      effectiveMute,
      'AutoMod: exceeded warning limit'
    );

    await infractionsService
      .create({
        guild,
        user: message.author,
        moderator: client.user,
        type: 'MUTE',
        reason: 'AutoMod: exceeded warning limit',
        duration: effectiveMute
      })
      .catch(() => null);

    let afterMuteUser = updatedUser;
    try {
      afterMuteUser = await warningsService.applyMutePenalty(guild.id, message.author.id);
    } catch (err) {
      console.error('[AutoMod] Failed to apply mute penalty on trust:', err);
    }

    const trustAfterMute = trustCfg.enabled
      ? clamp(
          afterMuteUser?.trust ?? trustAfterWarn,
          trustCfg.min,
          trustCfg.max
        )
      : afterMuteUser?.trust ?? trustAfterWarn;

    const trustAfterLine = trustCfg.enabled
      ? `🔐 Trust after mute: **${trustAfterMute}/${trustCfg.max}**`
      : '';

    await message.channel
      .send({
        content: buildMuteChannelMessage({
          userMention: `${message.author}`,
          minutes: mins,
          reason: 'Exceeded the warning limit',
          trustText: '' // NÃO mostrar trust no canal
        })
      })
      .catch(() => null);

    if (config.notifications?.dmOnMute) {
      const dmText = buildMuteDMMessage({
        guildName: guild.name,
        minutes: mins,
        reason: 'Exceeded the warning limit',
        trustText: '' // NÃO mostrar trust no DM
      });

      await trySendDM(message.author, dmText);
    }

    await logger(
      client,
      'Automatic Mute',
      message.author,
      client.user,
      `Duration: **${mins} minutes**\n` +
        (trustCfg.enabled ? `Trust after mute: **${trustAfterMute}/${trustCfg.max}**` : ''),
      guild
    );

    await warningsService.resetWarnings(guild.id, message.author.id).catch(() => null);
  } catch (err) {
    console.error('[AutoMod] Critical error:', err);
  }
};
