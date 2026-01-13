const Parser = require('rss-parser');
const crypto = require('crypto');
const { EmbedBuilder } = require('discord.js');
const GameNews = require('../database/models/GameNews');
const logger = require('./logger');

const parser = new Parser({ timeout: 15000 }); // Timeout de 15s para o RSS

/**
 * Gera um hash único para cada notícia
 * Evita que a mesma notícia seja enviada várias vezes
 * @param {Object} item - Item do RSS
 * @returns {string} hash
 */
function generateHash(item) {
  return crypto
    .createHash('sha256')
    .update(`${item.title}-${item.link}`)
    .digest('hex');
}

/**
 * Verifica se a notícia é nova
 * @param {string} feedName - Nome do feed (ex: GameSpot)
 * @param {Object} item - Item do RSS
 * @returns {Promise<boolean>} true se for nova
 */
async function isNewNews(feedName, item) {
  const hash = generateHash(item);

  let record = await GameNews.findOne({ source: feedName });

  if (!record) {
    // Cria registro se não existir
    await GameNews.create({ source: feedName, lastHash: hash });
    return true;
  }

  if (record.lastHash === hash) return false;

  // Atualiza hash da última notícia
  record.lastHash = hash;
  await record.save();
  return true;
}

/**
 * Sistema automático de notícias
 * @param {Client} client - Cliente Discord
 * @param {Object} config - Configurações do bot
 */
module.exports = async (client, config) => {
  if (!config.gameNews?.enabled) return;

  console.log('[GameNews] Sistema de notícias iniciado');

  setInterval(async () => {
    for (const feed of config.gameNews.sources) {
      try {
        const parsed = await parser.parseURL(feed.feed);

        if (!parsed.items?.length) continue;

        const item = parsed.items[0];
        if (!item?.title || !item?.link) continue;

        const isNew = await isNewNews(feed.name, item);
        if (!isNew) {
          console.log(`[GameNews] Notícia duplicada ignorada: ${item.title}`);
          continue;
        }

        // Pega o canal onde a notícia será enviada
        const channel = await client.channels.fetch(feed.channelId).catch(() => null);
        if (!channel) {
          console.warn(`[GameNews] Canal não encontrado: ${feed.channelId}`);
          continue;
        }

        // Cria o embed da notícia
        const embed = new EmbedBuilder()
          .setTitle(item.title)
          .setURL(item.link)
          .setDescription(item.contentSnippet || 'Sem descrição disponível')
          .setColor(0xe60012)
          .setFooter({ text: feed.name })
          .setTimestamp(new Date(item.pubDate || Date.now()));

        if (item.enclosure?.url) embed.setThumbnail(item.enclosure.url);

        // Envia a notícia no canal do feed
        await channel.send({ embeds: [embed] });

        // 🔹 Log centralizado no log-bot
        await logger(
          client,
          'Game News',
          channel.guild.members.me.user, // usuário "afectado"
          channel.guild.members.me.user, // executor
          `Nova notícia enviada: **${item.title}**`,
          channel.guild
        );

        console.log(`[GameNews] Enviada notícia: ${item.title}`);

      } catch (err) {
        console.error(`[GameNews] Erro ao processar feed ${feed.name}:`, err.message);
      }
    }
  }, config.gameNews.interval);
};
