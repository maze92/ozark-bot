// src/systems/antiSpam.js
// ============================================================
// Anti-Spam / Flood protection
//
// O que faz:
// - Deteta flood (muitas mensagens num intervalo curto)
// - Aplica timeout automaticamente (mute)
// - Regista infração no MongoDB (via infractionsService)
// - Regista log no Discord (log-bot) + Dashboard (via logger)
//
// Notas:
// - Tem proteção para não “mutar em loop” o mesmo utilizador
// - Tem limpeza automática para evitar crescimento infinito de memória
// - Tem um "lock" simples para evitar múltiplas punições simultâneas
// ============================================================

const { PermissionsBitField } = require('discord.js');
const config = require('../config/defaultConfig');
const infractionsService = require('./infractionsService');
const logger = require('./logger');

// ------------------------------------------------------------
// Estrutura em memória para tracking de mensagens
// key: `${guildId}:${userId}`
// value: { timestamps: number[], lastActionAt: number, isActing: boolean }
// ------------------------------------------------------------
const messageMap = new Map();

// ------------------------------------------------------------
// Limpeza periódica (evita “memory leak”)
// - Remove entradas antigas/sem atividade
// ------------------------------------------------------------
const CLEANUP_EVERY_MS = 60_000; // 1 min

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [key, data] of messageMap.entries()) {
    // Se não houver data válida, remove
    if (!data || !Array.isArray(data.timestamps)) {
      messageMap.delete(key);
      continue;
    }

    // Se estiver vazio e a última ação foi há muito tempo, remove
    const lastTs = data.timestamps[data.timestamps.length - 1];
    const lastSeen = lastTs || data.lastActionAt || 0;

    // 5 minutos sem atividade = remove
    if (!lastSeen || now - lastSeen > 5 * 60_000) {
      messageMap.delete(key);
    }
  }
}, CLEANUP_EVERY_MS);

// Railway/Node: não manter processo vivo só por causa do timer
if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

/**
 * AntiSpam handler
 * @param {Message} message
 * @param {Client} client
 */
module.exports = async function antiSpam(message, client) {
  try {
    // ------------------------------
    // 1) Validações básicas
    // ------------------------------
    if (!config.antiSpam?.enabled) return;
    if (!message?.guild) return; // ignora DMs
    if (!message?.author || message.author.bot) return;

    // Em raros casos message.member pode vir null (partials/caches)
    if (!message.member) return;

    const guild = message.guild;
    const botMember = guild.members.me;
    if (!botMember) return;

    // ------------------------------
    // 2) Config do AntiSpam (defaults seguros)
    // ------------------------------
    const intervalMs = Number(config.antiSpam.interval ?? 7000);           // janela (ms)
    const maxMessages = Number(config.antiSpam.maxMessages ?? 6);          // msgs na janela
    const muteDurationMs = Number(config.antiSpam.muteDuration ?? 60_000); // timeout (ms)
    const actionCooldownMs = Number(config.antiSpam.actionCooldown ?? 60_000);

    // Sanitização de valores (evita configs inválidas)
    const safeInterval = Number.isFinite(intervalMs) && intervalMs > 500 ? intervalMs : 7000;
    const safeMax = Number.isFinite(maxMessages) && maxMessages >= 3 ? maxMessages : 6;
    const safeMute = Number.isFinite(muteDurationMs) && muteDurationMs >= 5_000 ? muteDurationMs : 60_000;
    const safeActionCooldown =
      Number.isFinite(actionCooldownMs) && actionCooldownMs >= 5_000 ? actionCooldownMs : 60_000;

    const now = Date.now();
    const key = `${guild.id}:${message.author.id}`;

    // ------------------------------
    // 3) Bypass (opcional)
    // ------------------------------
    // 3.1 Admin bypass
    const bypassAdmins = config.antiSpam.bypassAdmins ?? true;
    if (bypassAdmins && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return;
    }

    // 3.2 Bypass por cargos (opcional)
    if (Array.isArray(config.antiSpam.bypassRoles) && config.antiSpam.bypassRoles.length > 0) {
      const hasBypassRole = message.member.roles.cache.some((r) =>
        config.antiSpam.bypassRoles.includes(r.id)
      );
      if (hasBypassRole) return;
    }

    // ------------------------------
    // 4) Hierarquia: se user tem cargo >= bot, não dá para moderar
    // ------------------------------
    if (message.member.roles.highest.position >= botMember.roles.highest.position) {
      return;
    }

    // ------------------------------
    // 5) Permissões do bot (timeout exige ModerateMembers)
    // ------------------------------
    const perms = message.channel.permissionsFor(botMember);
    if (!perms?.has(PermissionsBitField.Flags.ModerateMembers)) {
      return;
    }

    // ------------------------------
    // 6) Anti-loop: se já aplicámos ação há pouco tempo, ignora
    // ------------------------------
    const prev = messageMap.get(key);
    if (prev?.lastActionAt && now - prev.lastActionAt < safeActionCooldown) {
      return;
    }

    // ------------------------------
    // 7) Atualiza janela de timestamps
    // ------------------------------
    const data = prev || { timestamps: [], lastActionAt: 0, isActing: false };

    // Mantém só timestamps dentro da janela
    data.timestamps = data.timestamps.filter((ts) => now - ts < safeInterval);
    data.timestamps.push(now);
    messageMap.set(key, data);

    // Ainda não atingiu limite
    if (data.timestamps.length < safeMax) return;

    // ------------------------------
    // 8) Lock simples (evita múltiplas punições simultâneas)
    // ------------------------------
    if (data.isActing) return;
    data.isActing = true;
    messageMap.set(key, data);

    // ------------------------------
    // 9) Se não dá para moderar, desbloqueia e sai
    // ------------------------------
    if (!message.member.moderatable) {
      data.isActing = false;
      messageMap.set(key, data);
      return;
    }

    // ------------------------------
    // 10) Aplicar timeout (mute)
    // ------------------------------
    await message.member.timeout(safeMute, 'Spam detected (AntiSpam)');

    // Marca última ação (anti-loop) e limpa timestamps para não reativar instantâneo
    data.lastActionAt = Date.now();
    data.timestamps = [];
    data.isActing = false;
    messageMap.set(key, data);

    // Feedback no canal (opcional)
    if (config.antiSpam.sendMessage !== false) {
      await message.channel
        .send(`🔇 ${message.author} has been muted for spam.`)
        .catch(() => null);
    }

    // ------------------------------
    // 11) Registar infração no MongoDB (via service)
    // ------------------------------
    await infractionsService.create({
      guild,
      user: message.author,
      moderator: client.user,
      type: 'MUTE',
      reason: 'Spam / Flood detected',
      duration: safeMute
    });

    // ------------------------------
    // 12) Log (Discord + Dashboard)
    // ------------------------------
    await logger(
      client,
      'Anti-Spam Mute',
      message.author,
      client.user,
      `User muted for spam.\nDuration: **${Math.round(safeMute / 1000)}s**\nThreshold: **${safeMax} messages / ${safeInterval}ms**`,
      guild
    );
  } catch (err) {
    console.error('[antiSpam] Error:', err);
  }
};
