// src/systems/autoModeration.js
// ============================================================
// AutoMod 2.0 (com Trust Score)
// ------------------------------------------------------------
// Faz:
// - deteta banned words
// - apaga mensagem (se o bot tiver ManageMessages)
// - adiciona warning (warningsService)
// - cria infração WARN (infractionsService)
// - aplica timeout (MUTE) se atingir maxWarnings
// - ajusta trust score do utilizador (campo "trust" no User)
// - regista timestamps lastInfractionAt / lastTrustUpdateAt
//
// Regras de trust sugeridas (valores por defeito):
// - WARN  → trust -= 5
// - MUTE  → trust -= 15
// - a cada X dias sem infração → trust regenera (+1/dia até máximo)
// - trust < 10  → menos tolerância (atinge mais rápido o mute)
// - trust > 60  → pode ser usado no futuro para suavizar penalizações
//
// NOTA: valores podem ser personalizados via config.trust (se existir)
// ============================================================

const { PermissionsBitField } = require('discord.js');
const config = require('../config/defaultConfig');

const logger = require('./logger');
const warningsService = require('./warningsService');
const infractionsService = require('./infractionsService');

// ------------------------------------------------------------
// Helpers de Trust
// ------------------------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Lê config.trust com defaults seguros
 */
function getTrustConfig() {
  const cfg = config.trust || {};

  return {
    enabled: cfg.enabled !== false,                  // por defeito: ligado
    base: cfg.base ?? 30,
    min: cfg.min ?? 0,
    max: cfg.max ?? 100,

    warnPenalty: cfg.warnPenalty ?? 5,
    mutePenalty: cfg.mutePenalty ?? 15,

    regenPerDay: cfg.regenPerDay ?? 1,
    regenMaxDays: cfg.regenMaxDays ?? 30,            // evita saltos gigantes (ex: +300 trust)

    lowThreshold: cfg.lowThreshold ?? 10,
    highThreshold: cfg.highThreshold ?? 60,

    // como a trust influencia a severidade
    lowTrustWarningsPenalty: cfg.lowTrustWarningsPenalty ?? 1, // reduz nº de avisos tolerados
    lowTrustMuteMultiplier: cfg.lowTrustMuteMultiplier ?? 1.5, // aumenta duração do mute
    highTrustMuteMultiplier: cfg.highTrustMuteMultiplier ?? 0.8 // reduz ligeiramente o mute
  };
}

/**
 * Garante que o trust fica dentro de [min, max]
 */
function clampTrust(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Regenera trust em função do tempo sem infrações.
 * - é chamada no momento em que o utilizador COMETE uma nova infração
 *   (lazy update → o "bónus" é aplicado quando voltamos a tocar no registo)
 */
function applyTrustRegeneration(userDoc, trustCfg, now) {
  if (!trustCfg.enabled) return;

  // se nunca teve infração, podemos usar createdAt / lastTrustUpdateAt como base
  const lastUpdate =
    userDoc.lastTrustUpdateAt ||
    userDoc.lastInfractionAt ||
    userDoc.createdAt ||
    now;

  const diffMs = now.getTime() - lastUpdate.getTime();
  if (diffMs < DAY_MS) return; // menos de 1 dia → não regenera

  let days = Math.floor(diffMs / DAY_MS);

  // evita "explosões" de trust se o bot ficar semanas parado
  if (days > trustCfg.regenMaxDays) {
    days = trustCfg.regenMaxDays;
  }

  const bonus = days * trustCfg.regenPerDay;
  if (!bonus || bonus <= 0) return;

  const currentTrust = Number.isFinite(userDoc.trust)
    ? userDoc.trust
    : trustCfg.base;

  userDoc.trust = clampTrust(
    currentTrust + bonus,
    trustCfg.min,
    trustCfg.max
  );

  userDoc.lastTrustUpdateAt = now;
}

/**
 * Aplica penalização de trust para um tipo de infração
 * type: 'WARN' | 'MUTE'
 */
function applyTrustPenalty(userDoc, trustCfg, type, now) {
  if (!trustCfg.enabled) return;

  const currentTrust = Number.isFinite(userDoc.trust)
    ? userDoc.trust
    : trustCfg.base;

  let penalty = 0;
  if (type === 'WARN') penalty = trustCfg.warnPenalty;
  if (type === 'MUTE') penalty = trustCfg.mutePenalty;

  if (!penalty || penalty <= 0) {
    userDoc.lastInfractionAt = now;
    userDoc.lastTrustUpdateAt = now;
    return;
  }

  userDoc.trust = clampTrust(
    currentTrust - penalty,
    trustCfg.min,
    trustCfg.max
  );

  userDoc.lastInfractionAt = now;
  userDoc.lastTrustUpdateAt = now;
}

/**
 * Calcula quantos avisos podem ser dados até ao mute,
 * ajustando pela trust (menos tolerância se trust muito baixa).
 */
function getEffectiveMaxWarnings(baseMaxWarnings, trustCfg, trustValue) {
  const t = Number.isFinite(trustValue) ? trustValue : trustCfg.base;
  let effective = baseMaxWarnings;

  if (!trustCfg.enabled) return effective;

  // trust muito baixa → reduz nº de avisos tolerados (mais agressivo)
  if (t <= trustCfg.lowThreshold) {
    effective = Math.max(
      1,
      baseMaxWarnings - trustCfg.lowTrustWarningsPenalty
    );
  }

  // poderias adicionar lógica para trust alta no futuro (ex: +1 aviso), se quiseres
  return effective;
}

/**
 * Ajusta duração do mute conforme trust
 */
function getEffectiveMuteDuration(baseMs, trustCfg, trustValue) {
  if (!trustCfg.enabled) return baseMs;
  const t = Number.isFinite(trustValue) ? trustValue : trustCfg.base;

  let duration = baseMs;

  if (t <= trustCfg.lowThreshold) {
    duration = Math.round(baseMs * trustCfg.lowTrustMuteMultiplier);
  } else if (t >= trustCfg.highThreshold) {
    duration = Math.round(baseMs * trustCfg.highTrustMuteMultiplier);
  }

  // garante pelo menos 30s e no máximo 28 dias (limite Discord)
  const MIN_MS = 30 * 1000;
  const MAX_MS = 28 * DAY_MS;

  if (!Number.isFinite(duration) || duration < MIN_MS) duration = MIN_MS;
  if (duration > MAX_MS) duration = MAX_MS;

  return duration;
}

// ============================================================
// Handler principal do AutoMod
// ============================================================
module.exports = async function autoModeration(message, client) {
  try {
    if (!message?.guild) return;
    if (!message?.content) return;
    if (message.author?.bot) return;
    if (!message.member) return;

    // evita processar mesma mensagem duas vezes
    if (message._autoModHandled) return;
    message._autoModHandled = true;

    const guild = message.guild;
    const botMember = guild.members.me;
    if (!botMember) return;

    const trustCfg = getTrustConfig();
    const now = new Date();

    // --------------------------------------------------------
    // Bypass: Administradores
    // --------------------------------------------------------
    if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return;
    }

    // Hierarquia: user com cargo >= ao bot não pode ser moderado
    if (message.member.roles.highest.position >= botMember.roles.highest.position) {
      return;
    }

    // --------------------------------------------------------
    // Preparar lista de banned words
    // --------------------------------------------------------
    const bannedWords = [
      ...(config.bannedWords?.pt || []),
      ...(config.bannedWords?.en || [])
    ];

    const baseMaxWarnings = config.maxWarnings ?? 3;
    const baseMuteDuration = config.muteDuration ?? (10 * 60 * 1000);

    // --------------------------------------------------------
    // Normalizar conteúdo da mensagem
    // --------------------------------------------------------
    const cleanContent = message.content
      .replace(/https?:\/\/\S+/gi, '')             // remove links
      .replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, '')     // emojis custom
      .replace(/[^\w\s]/g, '')                     // pontuação
      .toLowerCase();

    // --------------------------------------------------------
    // Detetar banned words com suporte a variações tipo "leet"
    // --------------------------------------------------------
    const foundWord = bannedWords.find(word => {
      const pattern = String(word)
        .replace(/a/gi, '[a4@]')
        .replace(/e/gi, '[e3]')
        .replace(/i/gi, '[i1!]')
        .replace(/o/gi, '[o0]')
        .replace(/u/gi, '[uü]')
        .replace(/s/gi, '[s5$]');
      return new RegExp(`\\b${pattern}\\b`, 'i').test(cleanContent);
    });

    if (!foundWord) return;

    const perms = message.channel.permissionsFor(botMember);
    const canDelete = perms?.has(PermissionsBitField.Flags.ManageMessages);
    const canTimeout = perms?.has(PermissionsBitField.Flags.ModerateMembers);

    // --------------------------------------------------------
    // Apagar mensagem ofensiva (se possível)
    // --------------------------------------------------------
    if (canDelete) {
      await message.delete().catch(() => null);
    }

    // --------------------------------------------------------
    // +1 warning via warningsService
    // dbUser é o documento User do Mongo (User schema)
    // --------------------------------------------------------
    let dbUser = await warningsService.addWarning(guild.id, message.author.id, 1);

    // garante defaults de trust
    if (!Number.isFinite(dbUser.trust)) {
      dbUser.trust = trustCfg.base;
    }

    // 1) Regenerar trust pelos dias sem infração
    applyTrustRegeneration(dbUser, trustCfg, now);

    // 2) Penalização por WARN
    applyTrustPenalty(dbUser, trustCfg, 'WARN', now);

    // 3) Guardar alterações de trust/warnings/timestamps
    await dbUser.save().catch(() => null);

    // --------------------------------------------------------
    // Criar infração WARN
    // --------------------------------------------------------
    await infractionsService.create({
      guild,
      user: message.author,
      moderator: client.user,
      type: 'WARN',
      reason: `AutoMod detected banned word: ${foundWord}`,
      duration: null
    }).catch(() => null);

    // --------------------------------------------------------
    // Aviso no canal
    // --------------------------------------------------------
    const effectiveMaxWarnings = getEffectiveMaxWarnings(
      baseMaxWarnings,
      trustCfg,
      dbUser.trust
    );

    await message.channel.send({
      content:
        `⚠️ ${message.author}, inappropriate language is not allowed.\n` +
        `**Warning:** ${dbUser.warnings}/${effectiveMaxWarnings}\n` +
        (trustCfg.enabled
          ? `🔐 **Trust:** ${dbUser.trust}/${trustCfg.max}`
          : '')
    }).catch(() => null);

    // --------------------------------------------------------
    // Log do WARN automático
    // --------------------------------------------------------
    await logger(
      client,
      'Automatic Warn',
      message.author,
      client.user,
      `Word: **${foundWord}**\n` +
      `Warnings: **${dbUser.warnings}/${effectiveMaxWarnings}**\n` +
      (trustCfg.enabled ? `Trust: **${dbUser.trust}/${trustCfg.max}**\n` : '') +
      `Deleted: **${canDelete ? 'yes' : 'no'}**`,
      guild
    );

    // --------------------------------------------------------
    // Verificar se atingiu limite de avisos (ajustado pela trust)
    // --------------------------------------------------------
    if (dbUser.warnings < effectiveMaxWarnings) {
      // ainda não atingiu o limite para mute
      return;
    }

    // --------------------------------------------------------
    // Timeout automático (MUTE) se atingiu ou ultrapassou limite
    // --------------------------------------------------------
    if (!canTimeout || !message.member.moderatable) return;

    const effectiveMute = getEffectiveMuteDuration(
      baseMuteDuration,
      trustCfg,
      dbUser.trust
    );

    await message.member.timeout(effectiveMute, 'AutoMod: exceeded warning limit');

    // infração MUTE
    await infractionsService.create({
      guild,
      user: message.author,
      moderator: client.user,
      type: 'MUTE',
      reason: 'AutoMod: exceeded warning limit',
      duration: effectiveMute
    }).catch(() => null);

    // trust: penalização por MUTE
    // (carrega de novo o user para ter versão atualizada, opcional mas mais seguro)
    try {
      const freshUser = dbUser; // podias refazer o findOne, mas reaproveitamos
      applyTrustRegeneration(freshUser, trustCfg, now); // pequena regen extra (quase sempre 0)
      applyTrustPenalty(freshUser, trustCfg, 'MUTE', now);
      await freshUser.save().catch(() => null);
    } catch {
      // se falhar, não estraga o fluxo
    }

    await message.channel.send(
      `🔇 ${message.author} has been muted for **${Math.round(effectiveMute / 60000)} minutes** due to repeated infractions.`
    ).catch(() => null);

    await logger(
      client,
      'Automatic Mute',
      message.author,
      client.user,
      `Duration: **${Math.round(effectiveMute / 60000)} minutes**\n` +
      (trustCfg.enabled ? `Trust after mute: **${dbUser.trust}/${trustCfg.max}**` : ''),
      guild
    );

    // reset warnings após mute
    await warningsService.resetWarnings(guild.id, message.author.id).catch(() => null);

  } catch (err) {
    console.error('[AutoMod] Critical error:', err);
  }
};
