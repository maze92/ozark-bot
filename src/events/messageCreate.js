// src/events/messageCreate.js
// ============================================================
// Evento: messageCreate
//
// Responsável por:
// 1) Encaminhar comandos prefixados para o handler central: /src/systems/commands.js
// 2) Executar AutoMod (e opcionalmente AntiSpam) em mensagens normais
//
// Regras importantes:
// - Se for comando, NÃO executa AutoMod (evita conflitos/falsos positivos)
// - Ignora bots e DMs
// - Faz fetch de partials quando necessário
// ============================================================

const config = require('../config/defaultConfig');
const commandsHandler = require('../systems/commands');      // ✅ comandos centralizados aqui
const autoModeration = require('../systems/autoModeration'); // ✅ automod
// const antiSpam = require('../systems/antiSpam');          // (opcional) ativa se quiseres AntiSpam

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    try {
      // ------------------------------------------------------------
      // Validações básicas
      // ------------------------------------------------------------
      if (!message) return;
      if (!message.guild) return;          // Ignora DMs
      if (!message.content) return;
      if (message.author?.bot) return;     // Ignora bots

      // ------------------------------------------------------------
      // Garantir dados completos (partials)
      // - Em alguns casos o Discord manda mensagens incompletas
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
      // 1) Se for comando → delega no systems/commands.js e termina
      // - Evita duplicação de lógica e conflitos com AutoMod
      // ------------------------------------------------------------
      if (message.content.startsWith(prefix)) {
        await commandsHandler(message, client);
        return;
      }

      // ------------------------------------------------------------
      // 2) Mensagens normais → AutoMod primeiro
      // ------------------------------------------------------------
      await autoModeration(message, client);

      // ------------------------------------------------------------
      // 3) (Opcional) AntiSpam depois do AutoMod
      // - Só ativa se realmente quiseres este sistema
      // ------------------------------------------------------------
      // await antiSpam(message, client);

    } catch (err) {
      console.error('[messageCreate] Critical error:', err);
    }
  });
};
