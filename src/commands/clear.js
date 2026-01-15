// src/commands/clear.js
const { PermissionsBitField } = require('discord.js');
const logger = require('../systems/logger');

module.exports = {
  name: 'clear',
  description: 'Clear messages in the channel',

  /**
   * Uso: !clear <1-100>
   */
  async execute(message, args, client) {
    try {
      if (!message.guild) return;

      const botMember = message.guild.members.me;
      if (!botMember) return;

      // permissão do bot
      const perms = message.channel.permissionsFor(botMember);
      if (!perms?.has(PermissionsBitField.Flags.ManageMessages)) {
        return message.reply('❌ I do not have permission to manage messages.').catch(() => null);
      }

      const amount = parseInt(args[0], 10);
      if (!amount || amount < 1 || amount > 100) {
        return message.reply('❌ Usage: !clear <1-100>').catch(() => null);
      }

      const deleted = await message.channel.bulkDelete(amount, true);

      const reply = await message.channel
        .send(`🧹 Cleared **${deleted.size}** messages.`)
        .catch(() => null);

      if (reply) setTimeout(() => reply.delete().catch(() => null), 5000).unref?.();

      await logger(
        client,
        'Clear Messages',
        null,
        message.author,
        `Cleared **${deleted.size}** messages in #${message.channel.name}`,
        message.guild
      );

    } catch (err) {
      console.error('[clear] Error:', err);
      message.reply('❌ An unexpected error occurred.').catch(() => null);
    }
  }
};
