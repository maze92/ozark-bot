/**
 * Evento: clientReady
 * 
 * É executado UMA única vez quando:
 * - O bot já está autenticado
 * - O Discord Gateway já terminou o handshake
 * - O client já está pronto para usar (canais, guilds, cache, etc.)
 * 
 * Importante:
 * - NÃO iniciamos GameNews aqui, porque já é iniciado no index.js
 *   (evita duplicação de setInterval / spam / comportamento repetido)
 */

const { ActivityType } = require('discord.js');

let started = false;

module.exports = (client) => {
  client.once('clientReady', async () => {
    // ------------------------------
    // Evita execução duplicada (segurança extra)
    // ------------------------------
    if (started) return;
    started = true;

    // ------------------------------
    // Confirma bot online
    // ------------------------------
    console.log(`✅ ${client.user?.tag || 'Bot'} is online!`);

    // ------------------------------
    // Presence / Status do bot
    // ------------------------------
    try {
      await client.user.setPresence({
        activities: [
          {
            name: 'moderating the server',
            type: ActivityType.Watching
          }
        ],
        status: 'online'
      });
    } catch (err) {
      console.error('[ready] Error setting presence:', err);
    }
  });
};
