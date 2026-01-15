// src/commands/mute.js

const { PermissionsBitField } = require('discord.js');
const logger = require('../systems/logger');
const config = require('../config/defaultConfig');

/**
 * Converte um texto tipo "10m", "1h", "2d" para milissegundos.
 * Suporta:
 * - s (segundos)
 * - m (minutos)
 * - h (horas)
 * - d (dias)
 *
 * Exemplos:
 * - 30s -> 30000
 * - 10m -> 600000
 * - 1h  -> 3600000
 * - 2d  -> 172800000
 */
function parseDuration(input) {
  if (!input || typeof input !== 'string') return null;

  const match = input.trim().toLowerCase().match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (!value || value <= 0) return null;

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

/**
 * Formata ms para texto curto (ex: 600000 -> "10m")
 */
function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (day >= 1 && day * 24 * 60 * 60 * 1000 === ms) return `${day}d`;
  if (hour >= 1 && hour * 60 * 60 * 1000 === ms) return `${hour}h`;
  if (min >= 1 && min * 60 * 1000 === ms) return `${min}m`;
  return `${sec}s`;
}

module.exports = {
  name: 'mute',
  description: 'Mute a user (timeout) with optional duration and reason',
  allowedRoles: [
    '1385619241235120177',
    '1385619241235120174',
    '1385619241235120173'
  ],

  /**
   * Uso:
   * - !mute @user 10m razão...
   * - !mute @user razão...
   */
  async execute(message, args, client) {
    try {
      // ------------------------------
      // Validações básicas
      // ------------------------------
      if (!message.guild) return;
      if (!message.member) return;

      // ------------------------------
      // Verificar permissões do BOT
      // - Timeout (mute) exige ModerateMembers
      // ------------------------------
      const botMember = message.guild.members.me;
      if (!botMember) return message.reply('❌ Bot member not found.');

      const perms = message.channel.permissionsFor(botMember);
      if (!perms?.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply('❌ I do not have permission to timeout members (Moderate Members).');
      }

      // ------------------------------
      // Alvo (utilizador)
      // ------------------------------
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply(`❌ Usage: ${config.prefix}mute @user [10m/1h/2d] [reason...]`);
      }

      // Não permitir mutar bots (opcional, mas recomendado)
      if (target.user.bot) {
        return message.reply('⚠️ You cannot mute a bot.');
      }

      // ------------------------------
      // Hierarquia (Discord)
      // - Não dá para moderar quem tem cargo >= bot
      // - Nem quem tem cargo >= executor (para evitar abuso)
      // ------------------------------
      if (target.roles.highest.position >= botMember.roles.highest.position) {
        return message.reply('❌ I cannot mute this user (their role is higher/equal to my highest role).');
      }

      if (target.roles.highest.position >= message.member.roles.highest.position) {
        return message.reply('❌ You cannot mute this user (their role is higher/equal to yours).');
      }

      // ------------------------------
      // Duração e motivo
      // ------------------------------
      // args inclui tudo após o comando (sem o prefix)
      // exemplo: ["@user", "10m", "spamming", "links"]
      // porém o mention já foi consumido pelo Discord, então args[0] normalmente é "10m" ou "razão"
      const possibleDuration = args[0];
      const durationMs = parseDuration(possibleDuration) || config.muteDuration || 10 * 60 * 1000;

      // Se args[0] era duração válida, motivo começa em args[1]; senão começa em args[0]
      const reasonStartIndex = parseDuration(possibleDuration) ? 1 : 0;
      const reason = args.slice(reasonStartIndex).join(' ').trim() || 'No reason provided';

      // Limite do Discord para timeout (28 dias)
      const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;
      if (durationMs > MAX_TIMEOUT_MS) {
        return message.reply('❌ Timeout duration cannot exceed 28 days.');
      }

      // ------------------------------
      // Aplicar timeout (mute)
      // ------------------------------
      await target.timeout(durationMs, `Muted by ${message.author.tag}: ${reason}`);

      // Feedback no canal
      await message.channel.send(
        `🔇 **${target.user.tag}** has been muted for **${formatDuration(durationMs)}**.\n📝 Reason: **${reason}**`
      ).catch(() => null);

      // ------------------------------
      // Log no log-bot + dashboard
      // ------------------------------
      await logger(
        client,
        'Manual Mute',
        target.user,
        message.author,
        `Duration: **${formatDuration(durationMs)}**\nReason: **${reason}**`,
        message.guild
      );

    } catch (err) {
      console.error('[mute] Error:', err);
      return message.reply('❌ Failed to mute the user. Check my permissions and role hierarchy.');
    }
  }
};
