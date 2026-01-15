/**
 * Evento messageCreate
 * Responsável por:
 * - Processar comandos prefixados
 * - Executar o sistema de auto-moderação
 */

const autoModeration = require('../systems/autoModeration');
const config = require('../config/defaultConfig');

module.exports = client => {
  client.on('messageCreate', async message => {

    // ------------------------------
    // Validações básicas
    // ------------------------------
    if (!message) return;
    if (!message.guild) return;        // Ignora DMs
    if (!message.content) return;
    if (message.author.bot) return;    // Ignora bots

    const prefix = config.prefix;

    // ------------------------------
    // Comandos prefixados
    // ------------------------------
    if (message.content.startsWith(prefix)) {
      const args = message.content
        .slice(prefix.length)
        .trim()
        .split(/\s+/);

      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      const command = client.commands.get(commandName);
      if (!command) return;

      try {
        await command.execute(message, args, client);
      } catch (err) {
        console.error(`[Command Error] ${commandName}:`, err);

        // Feedback opcional ao utilizador
        message.reply('❌ There was an error executing this command.')
          .catch(() => null);
      }

      // IMPORTANTE:
      // Se for comando, não executa AutoMod
      return;
    }

    // ------------------------------
    // Auto Moderação
    // ------------------------------
    try {
      await autoModeration(message, client);
    } catch (err) {
      console.error('[AutoMod] Error in messageCreate:', err);
    }
  });
};
