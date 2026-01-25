// src/slash/commands.js

const { SlashCommandBuilder } = require('discord.js');

module.exports = function buildSlashCommands(prefix) {
  const p = prefix || '!';

  return [
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Issue a warning to a user')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('User to warn').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Reason').setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Mute a user')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('User to mute').setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('duration')
          .setDescription('Duration (ex: 10m, 2h, 1d)')
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Reason').setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('Unmute a user')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('User to unmute').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Reason').setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Clear messages from a channel')
      .addIntegerOption((opt) =>
        opt
          .setName('amount')
          .setDescription('Number of messages to clear (1-200)')
          .setRequired(true)
      )
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('Only delete messages from this user (optional)')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('Show information about a user')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('User to inspect').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('history')
      .setDescription('Show infractions history for a user')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('User to inspect').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('help')
      .setDescription(`Show help (prefix commands: ${p}...)`)
  ].map((c) => c.toJSON());
};
