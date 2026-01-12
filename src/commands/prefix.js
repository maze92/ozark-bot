// src/commands/prefix.js
const config = require('../config/defaultConfig');

module.exports = {
  name: 'prefix',
  permissions: ['ManageGuild'],

  async execute(message, args, client) {
    const newPrefix = args[0];
    if (!newPrefix) return message.reply(`❌ Usage: ${config.prefix}prefix <new_prefix>`);

    // Para demo: mudamos apenas em memória
    config.prefix = newPrefix;
    message.channel.send(`✅ Prefix updated to \`${newPrefix}\``);
  }
};
