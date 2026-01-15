// src/commands/warn.js
const { PermissionsBitField } = require('discord.js');

const logger = require('../systems/logger');
const warningsService = require('../systems/warningsService');
const infractionsService = require('../systems/infractionsService');

module.exports = {
  name: 'warn',
  description: 'Issue a warning to a user',

  // Podes remover isto se quiseres usar só config.staffRoles
  // allowedRoles: [],

  async execute(message, args, client) {
    try {
      if (!message.guild) return;

      const guild = message.guild;
      const botMember = guild.members.me;

      if (!botMember) return;

      // alvo
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ Please mention a user to warn.');

      // proteções básicas
      if (target.id === message.author.id) return message.reply('❌ You cannot warn yourself.');
      if (target.id === client.user.id) return message.reply('❌ You cannot warn the bot.');

      // hierarquia
      if (target.roles.highest.position >= botMember.roles.highest.position) {
        return message.reply('❌ I cannot warn this user due to role hierarchy.');
      }

      // razão opcional
      const reason = args.slice(1).join(' ').trim() || 'No reason provided';

      // add warning
      const dbUser = await warningsService.addWarning(guild.id, target.id, 1);

      // infração WARN
      await infractionsService.create({
        guild,
        user: target.user,
        moderator: message.author,
        type: 'WARN',
        reason,
        duration: null
      }).catch(() => null);

      await message.channel.send(`⚠️ ${target} has been warned.\n**Total warnings:** ${dbUser.warnings}`);

      await logger(
        client,
        'Manual Warn',
        target.user,
        message.author,
        `Reason: **${reason}**\nTotal warnings: **${dbUser.warnings}**`,
        guild
      );

    } catch (err) {
      console.error('[warn] Error:', err);
      message.reply('❌ An unexpected error occurred.').catch(() => null);
    }
  }
};
