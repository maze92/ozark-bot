// src/commands/togglemod.js
const config = require('../config/defaultConfig');

module.exports = {
  name: 'togglemod',
  permissions: ['ManageGuild'],

  async execute(message, args, client) {
    // Supondo que autoModeration tem um flag em memória por guild
    client.autoModEnabled = client.autoModEnabled || {};
    const current = client.autoModEnabled[message.guild.id] ?? true;

    client.autoModEnabled[message.guild.id] = !current;

    message.channel.send(`🛡️ AutoModeration is now **${!current ? 'enabled' : 'disabled'}** for this server.`);
  }
};
