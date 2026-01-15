/**
 * Sistema de Game News
 * - Lê feeds RSS configurados
 * - Envia notícias novas para canais do Discord
 * - Evita reposts usando hash guardado no MongoDB
 */

const Parser = require('rss-parser');
const crypto = require('crypto');
const { EmbedBuilder } = require('discord.js');
const GameNews = require('../database/models/GameNews');
const logger = require('./logger');

// Cria parser RSS com timeout de segurança
const parser = new Parser({ timeout: 15000 });

/**
 * Gera um hash único para cada notícia
 * Combinamos título + link → garante unicidade
 * @param {Object} item - Item do feed RSS
 * @returns {string} hash
 */
function generateHash(item) {
  return crypto
    .createHash('sha256')
    .update(`${item.title}-${item.link}`)
    .digest('hex');
}

/**
 * Verifica se a notícia já foi enviada
 * - Primeira notícia do feed → cria registro
 * - Hash igual → duplicada → ignora
 * - Hash diferente → atualiza registro → envia
 * @param {string} feedName - Nome do feed
 * @param {Object} item - Item do RSS
 * @returns {Promise<boolean>} true se é nova notícia
 */
async function isNewNews(feedName, item) {
  const hash = generateHash(item);

  let record = await GameNews.findOne({ source: feedName });

  // Primeira notícia do feed
  if (!record) {
    await GameNews.create({
      source: feedName,
      lastHash: hash
    });
    return true;
  }

  // Notícia duplicada
  if (record.lastHash === hash) return false;

  // Nova notícia → atualizar hash
  record.lastHash = hash;
  await record.save();
  return true;
}

/**
 * Função principal do sistema de Game News
 * @param {Client} client - Cliente Discord
 * @param {Object} config - Configuração do bot
 */
module.exports = async (client, config) => {
  if (!config.gameNews?.enabled) return;

  console.log('[GameNews] News system started');

  // ------------------------------
  // Loop de verificação periódica
  // ------------------------------
  setInterval(async () => {
    for (const feed of config.gameNews.sources) {
      try {
        // Faz parse do feed RSS
        const parsed = await parser.parseURL(feed.feed);
        if (!parsed.items || parsed.items.length === 0) continue;

        // Considera apenas a notícia mais recente
        const item = parsed.items[0];
        if (!item?.title || !item?.link) continue;

        // Verifica se notícia é nova
        const isNew = await isNewNews(feed.name, item);
        if (!isNew) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[GameNews] Duplicate news skipped: ${item.title}`);
          }
          continue;
        }

        // Busca o canal Discord
        const channel = await client.channels.fetch(feed.channelId).catch(() => null);
        if (!channel) {
          console.warn(`[GameNews] Channel not found: ${feed.channelId}`);
          continue;
        }

        // Cria embed para a notícia
        const embed = new EmbedBuilder()
          .setTitle(item.title)
          .setURL(item.link)
          .setDescription(item.contentSnippet || 'No description available')
          .setColor(0xe60012)
          .setFooter({ text: feed.name })
          .setTimestamp(new Date(item.pubDate || Date.now()));

        // Adiciona thumbnail se existir
        if (item.enclosure?.url) {
          embed.setThumbnail(item.enclosure.url);
        }

        // Envia notícia para o canal
        await channel.send({ embeds: [embed] });

        // Log no Discord + Dashboard
        await logger(
          client,
          'Game News',
          channel.guild.members.me.user,
          channel.guild.members.me.user,
          `New news sent: **${item.title}**`,
          channel.guild
        );

        console.log(`[GameNews] Sent news: ${item.title}`);
      } catch (err) {
        console.error(`[GameNews] Error processing feed ${feed.name}:`, err.message);
      }
    }
  }, config.gameNews.interval); // Intervalo definido no config
};
