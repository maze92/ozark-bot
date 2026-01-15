// src/events/messageCreate.js
// ============================================================
// messageCreate pipeline final:
// 1) comando -> systems/commands.js
// 2) mensagem normal -> AutoMod
// 3) depois -> AntiSpam (se enabled)
// ============================================================

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
