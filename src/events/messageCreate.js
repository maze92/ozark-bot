// src/events/messageCreate.js
// ============================================================
// Evento: messageCreate
//
// Responsável por:
// 1) Processar comandos prefixados (via systems/commands.js)
// 2) Aplicar AntiSpam (flood / spam)
// 3) Aplicar AutoModeration (palavras proibidas)
//
// Regras importantes:
// - Se for comando, NÃO executa AntiSpam nem AutoMod (evita conflitos)
// - Ignora bots e DMs
// - Faz fetch de partials quando necessário
// ============================================================

const config = require('../config/defaultConfig');

// ✅ Sistemas
const commandsHandler = require('../systems/commands');
const antiSpam = require('../systems/antiSpam');
const autoModeration = require('../systems/autoModeration');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    try {
      // ------------------------------------------------------------
      // 0) Validações básicas
      // ------------------------------------------------------------
      if (!message) return;
      if (!message.guild) return;            // Ignora DMs
      if (!message.content) return;
      if (message.author?.bot) return;       // Ignora bots

      // ------------------------------------------------------------
      // 1) Garantir dados completos (partials)
      // ------------------------------------------------------------
      if (message.partial) {
        try {
          await message.fetch();
        } catch {
          return;
        }
      }

      const prefix = config.prefix || '!';

      // ------------------------------------------------------------
      // 2) Se for comando -> delega no commandsHandler e TERMINA
      // ------------------------------------------------------------
      if (message.content.startsWith(prefix)) {
        await commandsHandler(message, client);
        return;
      }

      // ------------------------------------------------------------
      // 3) AntiSpam (primeiro)
      // - Detecta flood e aplica timeout automático
      // ------------------------------------------------------------
      if (config.antiSpam?.enabled) {
        await antiSpam(message, client);
      }

      // ------------------------------------------------------------
      // 4) AutoModeration (depois)
      // - Detecta palavras proibidas, dá warn e timeout ao atingir limite
      // ------------------------------------------------------------
      await autoModeration(message, client);

    } catch (err) {
      console.error('[messageCreate] Critical error:', err);
    }
  });
};
