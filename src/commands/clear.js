// src/commands/clear.js

const { PermissionsBitField } = require('discord.js');
const config = require('../config/defaultConfig');
const logger = require('../systems/logger');

module.exports = {
  name: 'clear',
  description: 'Clear messages in the channel',

  async execute(message, args, client) {
    try {

      if (!message?.guild) return;
      if (!message.channel) return;

      const guild = message.guild;
      const botMember = guild.members.me;
      if (!botMember) return;

      const perms = message.channel.permissionsFor(botMember);
      if (!perms?.has(PermissionsBitField.Flags.ManageMessages)) {
        return message
          .reply('❌ I do not have permission to manage messages in this channel.')
          .catch(() => null);
      }

      const raw = args[0];
      const amount = parseInt(raw, 10);

      if (!amount || Number.isNaN(amount) || amount < 1 || amount > 100) {
        const prefix = config.prefix || '!';
        return message
          .reply(`❌ Usage: \`${prefix}clear <1-100>\``)
          .catch(() => null);
      }

      const deleted = await message.channel.bulkDelete(amount, true).catch((err) => {
        console.error('[clear] bulkDelete error:', err);
        return null;
      });

      if (!deleted) {
        return message
          .reply('⚠️ I could not delete messages. They may be too old or I lack permissions.')
          .catch(() => null);
      }

      const feedback = await message.channel
        .send(`🧹 Cleared **${deleted.size}** messages.`)
        .catch(() => null);

      if (feedback) {
        setTimeout(() => {
          feedback.delete().catch(() => null);
        }, 5000).unref?.();
      }

      await logger(
        client,
        'Clear Messages',
        null,
        message.author,
        `Cleared **${deleted.size}** messages in #${message.channel.name}`,
        guild
      );

    } catch (err) {
      console.error('[clear] Error:', err);
      message
        .reply('❌ An unexpected error occurred while clearing messages.')
        .catch(() => null);
    }
  }
};
