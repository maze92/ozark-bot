// src/commands/mute.js
const { PermissionsBitField } = require('discord.js');

const logger = require('../systems/logger');
const infractionsService = require('../systems/infractionsService');
const config = require('../config/defaultConfig');

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
  description: 'Timeout (mute) a user with optional duration and reason',

  /**
   * Uso:
   * - !mute @user 10m reason...
   * - !mute @user reason...
   */
  async execute(message, args, client) {
    try {
      if (!message.guild) return;

      const guild = message.guild;
      const botMember = guild.members.me;
      if (!botMember) return;

      // permissão do bot para timeout
      const perms = message.channel.permissionsFor(botMember);
      if (!perms?.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply('❌ I do not have permission to timeout members (Moderate Members).').catch(() => null);
      }

      const target = message.mentions.members.first();
      if (!target) {
        return message.reply(`❌ Usage: ${config.prefix}mute @user [10m/1h/2d] [reason...]`).catch(() => null);
      }

      if (target.user.bot) return message.reply('⚠️ You cannot mute a bot.').catch(() => null);

      // já muted?
      if (target.isCommunicationDisabled()) {
        return message.reply(`⚠️ **${target.user.tag}** is already muted.`).catch(() => null);
      }

      // hierarquia bot
      if (target.roles.highest.position >= botMember.roles.highest.position) {
        return message.reply('❌ I cannot mute this user (role higher/equal to mine).').catch(() => null);
      }

      // remover mention dos args
      const cleanedArgs = args.filter(a => {
        const isMention = a.includes(`<@${target.id}>`) || a.includes(`<@!${target.id}>`);
        const isRawId = a === target.id;
        return !isMention && !isRawId;
      });

      const possibleDuration = cleanedArgs[0];
      const parsed = parseDuration(possibleDuration);

      const durationMs = parsed || config.muteDuration || 10 * 60 * 1000;

      // limite discord: 28 dias
      const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;
      if (durationMs > MAX_TIMEOUT_MS) {
        return message.reply('❌ Timeout duration cannot exceed 28 days.').catch(() => null);
      }

      const reasonStartIndex = parsed ? 1 : 0;
      const reason = cleanedArgs.slice(reasonStartIndex).join(' ').trim() || 'No reason provided';

      await target.timeout(durationMs, `Muted by ${message.author.tag}: ${reason}`);

      await message.channel.send(
        `🔇 **${target.user.tag}** has been muted for **${formatDuration(durationMs)}**.\n📝 Reason: **${reason}**`
      ).catch(() => null);

      await infractionsService.create({
        guild,
        user: target.user,
        moderator: message.author,
        type: 'MUTE',
        reason,
        duration: durationMs
      }).catch(() => null);

      await logger(
        client,
        'Manual Mute',
        target.user,
        message.author,
        `Duration: **${formatDuration(durationMs)}**\nReason: **${reason}**`,
        guild
      );

    } catch (err) {
      console.error('[mute] Error:', err);
      message.reply('❌ Failed to mute the user. Check my permissions and role hierarchy.').catch(() => null);
    }
  }
};
