const Parser = require('rss-parser');
const crypto = require('crypto');
const { EmbedBuilder } = require('discord.js');
const GameNews = require('../database/models/GameNews');
const logger = require('./logger');

const parser = new Parser({ timeout: 15000 });

// Cria um hash único para cada notícia
function generateHash(item) {
  return crypto
    .createHash('sha256')
    .update(`${item.title}-${item.link}`)
    .digest('hex');
}

// Verifica se a notícia é nova
async function isNewNews(feedName, item) {
  const hash = generateHash(item);

  let record = await GameNews.findOne({ source: feedName });

  if (!record) {
    await GameNews.create({ source: feedName, lastLink: hash });
    return true;
  }

  if (record.lastLink === hash) return false;

  record.lastLink = hash;
  await record.save();
  return true;
}

module.exports = async (client, config) => {
  if (!config.gameNews?.enabled) return;

  console.log('[GameNews] Automatic news system started.');

  setInterval(async () => {
    for (const feed of config.gameNews.sources) {
      try {
        const parsed = await parser.parseURL(feed.feed);
        const item = parsed.items?.[0];
        if (!item?.title || !item?.link) continue;

        const isNew = await isNewNews(feed.name, item);
        if (!isNew) continue;

        const channel = await client.channels.fetch(feed.channelId).catch(() => null);
        if (!channel) {
          console.warn(`[GameNews] Channel not found: ${feed.channelId}`);
          continue;
        }

        const embed = new EmbedBuilder()
          .setTitle(item.title)
          .setURL(item.link)
          .setDescription(item.contentSnippet || 'No description available')
          .setColor(0xe60012)
          .setFooter({ text: feed.name })
          .setTimestamp(new Date(item.pubDate || Date.now()));

        if (item.enclosure?.url) embed.setThumbnail(item.enclosure.url);

        await channel.send({ embeds: [embed] });

        // Log no log-bot
        if (channel.guild) {
          await logger(
            client,
            'Game News',
            channel.guild.members.me.user,
            channel.guild.members.me.user,
            `New article sent: **${item.title}**`,
            channel.guild
          );
        }

        console.log(`[GameNews] Sent news: ${item.title}`);
      } catch (err) {
        console.error(`[GameNews] Error processing feed ${feed.name}:`, err.message);
      }
    }
  }, config.gameNews.interval);
};
