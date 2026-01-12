const Parser = require("rss-parser");
const { EmbedBuilder } = require("discord.js");
const GameNews = require("../database/models/GameNews");
const logger = require("./logger");

const parser = new Parser();

// Normaliza a URL para evitar duplicatas causadas por parâmetros extras
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    urlObj.search = params.toString();
    return urlObj.toString();
  } catch {
    return url; // Retorna a URL original se não for possível normalizar
  }
}

// Verifica se a notícia já foi enviada
async function isNewNews(feedName, link) {
  const normalizedLink = normalizeUrl(link);

  let record = await GameNews.findOne({ source: feedName });
  if (!record) {
    await GameNews.create({ source: feedName, lastLink: normalizedLink });
    return true;
  }

  if (record.lastLink === normalizedLink) return false;

  record.lastLink = normalizedLink;
  await record.save();
  return true;
}

module.exports = async (client, config) => {
  if (!config.gameNews?.enabled) return;

  console.log("[GameNews] Automatic news system started.");

  setInterval(async () => {
    for (const feed of config.gameNews.sources) {
      try {
        const parsedFeed = await parser.parseURL(feed.feed);
        const latestNews = parsedFeed.items?.[0];
        if (!latestNews?.link) continue;

        if (!await isNewNews(feed.name, latestNews.link)) continue;

        const channel = await client.channels.fetch(feed.channelId).catch(() => null);
        if (!channel) {
          console.warn(`[GameNews] Channel not found: ${feed.channelId}`);
          continue;
        }

        const embed = new EmbedBuilder()
          .setTitle(latestNews.title)
          .setURL(latestNews.link)
          .setDescription(latestNews.contentSnippet || "No description available")
          .setColor(0xe60012)
          .setFooter({ text: feed.name })
          .setTimestamp(new Date(latestNews.pubDate));

        if (latestNews.enclosure?.url) embed.setThumbnail(latestNews.enclosure.url);

        await channel.send({ embeds: [embed] });

        // Log centralizado
        if (channel.guild) {
          await logger(client, "Game News", channel.guild.me.user, channel.guild.me.user, `New news sent: **${latestNews.title}**`);
        }

        console.log(`[GameNews] Sent news for ${feed.name}: ${latestNews.title}`);
      } catch (err) {
        console.error(`[GameNews] Error processing feed ${feed.name}:`, err.message);
      }
    }
  }, config.gameNews.interval);
};

