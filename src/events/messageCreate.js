const autoModeration = require('../systems/autoModeration');
const antiSpam = require('../systems/antiSpam');
const commands = require('../systems/commands');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    try {
      // 1️⃣ AutoMod (palavras, warns, etc)
      await autoModeration(message, client);

      // 2️⃣ Anti-Spam global
      await antiSpam(message, client);

      // 3️⃣ Comandos
      await commands(message, client);

    } catch (err) {
      console.error('[messageCreate] Error:', err);
    }
  });
};
