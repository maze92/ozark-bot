// src/systems/antiSpam.js
// ============================================================
// Anti-Spam / Flood protection
// - Detecta muitas mensagens num curto intervalo
// - Aplica timeout (mute) automaticamente
// - Regista a infração (MongoDB) e log (Discord + Dashboard)
// ============================================================

const { PermissionsBitField } = require('discord.js');
const config = require('../config/defaultConfig');
const infractionsService = require('./infractionsService'); // ✅ service (não confundir com model)
const logger = require('./logger');

// Guarda timestamps por guild+user para detectar flood
// key: `${guildId}:${userId}` -> [timestamp, timestamp, ...]
const messageMap = new Map();

/**
 * Sistema Anti-Spam
 * @param {Message} message
 * @param {Client} client
 */
module.exports = async function antiSpam(message, client) {
  try {
    // ------------------------------
    // Validações básicas
    // ------------------------------
    if (!config.antiSpam?.enabled) return;
    if (!message?.guild) return;
    if (!message?.author || message.author.bot) return;

    const guild = message.guild;
    const botMember = guild.members.me;
    if (!botMember) return;

    // ------------------------------
    // Bypass: Admins (opcional)
    // ------------------------------
    // Se quiseres que admins também sejam afetados, remove este bloco.
    if (message.member?.permissions?.has(PermissionsBitField.Flags.Administrator)) {
      return;
    }

    // ------------------------------
    // Hierarquia: se o utilizador tem cargo >= bot, não dá para moderar
    // ------------------------------
    if (message.member?.roles?.highest?.position >= botMember.roles.highest.position) {
      return;
    }

    // ------------------------------
    // Permissões do bot (timeout = ModerateMembers)
    // ------------------------------
    const perms = message.channel.permissionsFor(botMember);
    if (!perms?.has(PermissionsBitField.Flags.ModerateMembers)) {
      // Sem permissão não adianta continuar (evita spam de erros)
      return;
    }

    // ------------------------------
    // Config do AntiSpam (com defaults seguros)
    // ------------------------------
    const interval = config.antiSpam.interval ?? 7000;          // janela (ms)
    const maxMessages = config.antiSpam.maxMessages ?? 6;       // quantas msgs na janela
    const muteDuration = config.antiSpam.muteDuration ?? 60_000; // timeout (ms)

    const now = Date.now();
    const key = `${guild.id}:${message.author.id}`;

    // ------------------------------
    // Atualiza janela de timestamps
    // ------------------------------
    const arr = messageMap.get(key) || [];
    const fresh = arr.filter(ts => now - ts < interval);
    fresh.push(now);
    messageMap.set(key, fresh);

    // ------------------------------
    // Ainda não atingiu limite
    // ------------------------------
    if (fresh.length < maxMessages) return;

    // Atingiu limite -> reseta tracking (evita mutar em loop)
    messageMap.delete(key);

    // ------------------------------
    // Se não dá para moderar, sai (Discord.js helper)
    // ------------------------------
    if (!message.member?.moderatable) return;

    // ------------------------------
    // Aplica timeout (mute)
    // ------------------------------
    await message.member.timeout(muteDuration, 'Spam detected (AntiSpam)');

    // Feedback no canal (opcional)
    await message.channel
      .send(`🔇 ${message.author} muted for spam.`)
      .catch(() => null);

    // ------------------------------
    // Regista infração no MongoDB (via service)
    // ------------------------------
    await infractionsService.create({
      client,
      guild,
      user: message.author,
      moderator: client.user,
      type: 'MUTE',
      reason: 'Spam / Flood detected',
      duration: muteDuration
    });

    // ------------------------------
    // Log (Discord + Dashboard)
    // ------------------------------
    await logger(
      client,
      'Anti-Spam Mute',
      message.author,
      client.user,
      `User muted for spam.\nDuration: **${Math.round(muteDuration / 1000)}s**\nThreshold: **${maxMessages} msgs / ${interval}ms**`,
      guild
    );
  } catch (err) {
    console.error('[antiSpam] Error:', err);
  }
};
