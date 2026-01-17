// src/systems/autoModeration.js

const { PermissionsBitField } = require('discord.js');
const config = require('../config/defaultConfig');

const logger = require('./logger');
const warningsService = require('./warningsService');
const infractionsService = require('./infractionsService');
const { t } = require('./i18n');

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

  const tVal = Number.isFinite(trustValue) ? trustValue : trustCfg.base;
  let effective = baseMaxWarnings;

  if (tVal <= trustCfg.lowThreshold) {
    effective = baseMaxWarnings - (trustCfg.lowTrustWarningsPenalty || 1);
  }

  if (effective < 1) effective = 1;
  return effective;
}

function getEffectiveMuteDuration(baseMuteMs, trustCfg, trustValue) {
  if (!trustCfg.enabled) return baseMuteMs;

  const tVal = Number.isFinite(trustValue) ? trustValue : trustCfg.base;

  let multiplier = 1;
  if (tVal <= trustCfg.lowThreshold) {
    multiplier = trustCfg.lowTrustMuteMultiplier ?? 1.5;
  } else if (tVal >= trustCfg.highThreshold) {
    multiplier = trustCfg.highTrustMuteMultiplier ?? 0.8;
  }

  let duration = baseMuteMs * multiplier;

  const MIN_MS = 60 * 1000;
  const MAX_MS = 28 * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(duration) || duration < MIN_MS) duration = MIN_MS;
  if (duration > MAX_MS) duration = MAX_MS;

  return duration;
}

async function trySendDM(user, content) {
  try {
    if (!user) return;
    if (!content) return;
    await user.send({ content }).catch(() => null);
  } catch {
    // ignore
  }
}

function minutesFromMs(ms) {
  if (!Number.isFinite(ms)) return 0;
  return Math.round(ms / 60000);
}

function getLanguageBannedWords(language) {
  const bannedWords = config.bannedWords || {};

  const langWords = bannedWords[language] || bannedWords.en || [];
  const allWords = Array.isArray(bannedWords.all) ? bannedWords.all : [];

  const merged = [...langWords, ...allWords]
    .map((w) => String(w || '').trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(merged));
}

function findBannedWordInContent(content, language) {
  if (!content || typeof content !== 'string') return null;

  const words = getLanguageBannedWords(language);
  if (!words.length) return null;

  const lower = content.toLowerCase();

  for (const banned of words) {
    if (lower.includes(banned)) return banned;
  }

  return null;
}

module.exports = async (message, client) => {
  try {
    if (!message?.guild) return;
    if (!message.member) return;
    if (message.author?.bot) return;

    const guild = message.guild;
    const botMember = guild.members.me;
    if (!botMember) return;

    const baseCfg = config.autoModeration || {};
    if (baseCfg.enabled === false) return;

    if (!message.content || typeof message.content !== 'string') return;

    // evita DM
    if (message.channel?.isDMBased?.() || message.channel?.type === 1) return;

    // permissões mínimas
    const perms = message.channel.permissionsFor(botMember);
    if (!perms?.has(PermissionsBitField.Flags.ManageMessages)) return;

    // Config por canal (se existir)
    const channelCfg = (baseCfg.channels && baseCfg.channels[message.channel.id]) || null;
    const language = (channelCfg && channelCfg.language) || config.language || 'en';

    const foundWord = findBannedWordInContent(message.content, language);
    if (!foundWord) return;

    // roles isentas
    const exemptRoles = Array.isArray(baseCfg.exemptRoles) ? baseCfg.exemptRoles : [];
    if (exemptRoles.length && message.member.roles.cache.some((r) => exemptRoles.includes(r.id))) {
      return;
    }

    const trustCfg = getTrustConfig();

    // ✅ garante regen (com a correção no warningsService)
    const dbUser = await warningsService.getOrCreateUser(guild.id, message.author.id);

    const currentTrust = trustCfg.enabled
      ? clamp(dbUser?.trust ?? trustCfg.base, trustCfg.min, trustCfg.max)
      : trustCfg.base;

    const baseMaxWarnings = Number(baseCfg.maxWarnings ?? config.maxWarnings ?? 3);
    const effectiveMaxWarnings = getEffectiveWarningsLimit(baseMaxWarnings, trustCfg, currentTrust);

    // tenta apagar mensagem
    let deleted = true;
    try {
      await message.delete().catch((err) => {
        deleted = false;
        // 10008 = Unknown Message (já apagada)
        if (err?.code !== 10008) console.error('[AutoMod] Failed to delete message:', err);
      });
    } catch (err) {
      deleted = false;
      console.error('[AutoMod] Fatal error deleting message:', err);
    }

    // aplica warn + penalização trust (WARN)
    const updatedUser = await warningsService.addWarning(guild.id, message.author.id, 1);

    await infractionsService
      .create({
        guild,
        user: message.author,
        moderator: client.user,
        type: 'WARN',
        reason: t('automod.warnLogReason', language, foundWord),
        duration: null
      })
      .catch(() => null);

    // Mensagem pública (NÃO mostra trust)
    await message.channel
      .send({
        content: t('automod.warnChannel', language, {
          mention: `${message.author}`,
          warnings: updatedUser.warnings,
          maxWarnings: effectiveMaxWarnings
        })
      })
      .catch(() => null);

    // DM (NÃO mostra trust)
    if (config.notifications?.dmOnWarn) {
      await trySendDM(
        message.author,
        // mantém simples: usa a reason traduzida
        `${t('automod.warnReason', language, foundWord)}`
      );
    }

    // Log interno (pode ter trust)
    await logger(
      client,
      'Automatic Warn',
      message.author,
      client.user,
      `Word: **${foundWord}**\nWarnings: **${updatedUser.warnings}/${effectiveMaxWarnings}**\n` +
        (trustCfg.enabled ? `Trust: **${currentTrust}/${trustCfg.max}**\n` : '') +
        `Deleted: **${deleted ? 'yes' : 'no'}**`,
      guild
    );

    // ainda não chegou ao limite
    if (updatedUser.warnings < effectiveMaxWarnings) return;

    // precisa de permissão para timeout
    if (!perms.has(PermissionsBitField.Flags.ModerateMembers)) return;

    // já está em timeout?
    const isTimedOut =
      typeof message.member.isCommunicationDisabled === 'function'
        ? message.member.isCommunicationDisabled()
        : false;

    if (isTimedOut) return;

    const baseMuteMs = Number(baseCfg.muteDuration ?? config.muteDuration ?? 10 * 60 * 1000);

    // trust depois do warn já está em updatedUser.trust (penalização WARN aplicada)
    const trustAfterWarn = trustCfg.enabled
      ? clamp(updatedUser?.trust ?? currentTrust, trustCfg.min, trustCfg.max)
      : (updatedUser?.trust ?? currentTrust);

    const effectiveMuteMs = getEffectiveMuteDuration(baseMuteMs, trustCfg, trustAfterWarn);
    const mins = minutesFromMs(effectiveMuteMs);

    // aplicar timeout
    await message.member.timeout(effectiveMuteMs, 'AutoMod: exceeded warning limit');

    await infractionsService
      .create({
        guild,
        user: message.author,
        moderator: client.user,
        type: 'MUTE',
        reason: 'AutoMod: exceeded warning limit',
        duration: effectiveMuteMs
      })
      .catch(() => null);

    // penalização trust de mute
    let afterMuteUser = updatedUser;
    try {
      afterMuteUser = await warningsService.applyMutePenalty(guild.id, message.author.id);
    } catch (err) {
      console.error('[AutoMod] Failed to apply mute penalty on trust:', err);
    }

    const trustAfterMute = trustCfg.enabled
      ? clamp(afterMuteUser?.trust ?? trustAfterWarn, trustCfg.min, trustCfg.max)
      : (afterMuteUser?.trust ?? trustAfterWarn);

    // Mensagem pública (NÃO mostra trust)
    await message.channel
      .send({
        content: t('automod.muteChannel', language, {
          mention: `${message.author}`,
          minutes: mins
        })
      })
      .catch(() => null);

    // DM (NÃO mostra trust)
    if (config.notifications?.dmOnMute) {
      await trySendDM(
        message.author,
        t('automod.muteDM', language, { guildName: guild.name, minutes: mins })
      );
    }

    // Log interno (pode ter trust)
    await logger(
      client,
      'Automatic Mute',
      message.author,
      client.user,
      `Duration: **${mins} minutes**\n` +
        (trustCfg.enabled ? `Trust after mute: **${trustAfterMute}/${trustCfg.max}**` : ''),
      guild
    );

    // opcional: reset warnings após mute (comportamento comum)
    await warningsService.resetWarnings(guild.id, message.author.id).catch(() => null);
  } catch (err) {
    console.error('[AutoMod] Critical error:', err);
  }
};
