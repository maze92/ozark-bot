const { EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');

// Cache de logs para dashboard
const logCache = [];
module.exports.logCache = logCache;

/**
 * Logger centralizado
 * @param {Client} client - Discord client
 * @param {string} title - Título do log
 * @param {User|null} user - Usuário afetado
 * @param {User|null} executor - Executor da ação
 * @param {string} description - Descrição detalhada
 * @param {Guild} guild - Guild opcional (usado se o user não tiver guild)
 */
module.exports = async function logger(client, title, user, executor, description, guild) {
  guild = guild || user?.guild;
  if (!guild) return;

  // Enviar para canal de logs
  const logChannel = guild.channels.cache.find(ch => ch.name === (config.logChannelName || 'log-bot'));
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor('Blue')
      .setDescription(
        `👤 **User:** ${user?.tag || 'N/A'}\n` +
        `🛠️ **Executor:** ${executor?.tag || 'N/A'}\n` +
        `${description}`
      )
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => null);
  }

  // Adicionar ao cache do dashboard
  logCache.push({
    title,
    user: user?.tag || null,
    executor: executor?.tag || null,
    description,
    time: new Date()
  });

  // Manter apenas os últimos 100 logs
  if (logCache.length > 100) logCache.shift();
};
