// src/events/messageCreate.js

const config = require('../config/defaultConfig');
const commandsHandler = require('../systems/commands');
const autoModeration = require('../systems/autoModeration');
const antiSpam = require('../systems/antiSpam');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    try {
      if (!message) return;
      if (!message.guild) return;
      if (!message.content) return;
      if (message.author?.bot) return;

      if (message.partial) {
        try { await message.fetch(); } catch { return; }
      }

      const prefix = config.prefix || '!';
      const isCommand = message.content.startsWith(prefix);

      if (isCommand) {
        await commandsHandler(message, client);
        return;
      }

      await autoModeration(message, client);
      await antiSpam(message, client);

    } catch (err) {
      console.error('[messageCreate] Critical error:', err);
    }
  });
};
