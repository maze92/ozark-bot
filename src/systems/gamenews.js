const Parser = require("rss-parser");
const { EmbedBuilder } = require("discord.js");
const GameNews = require("../database/models/GameNews");
const logger = require("./logger");

const parser = new Parser();

function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    urlObj.search = params.toString();
    return urlObj.toString();
  } catch {
    return url;
  }
}

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

        const channel = await client.channels.fetch(feed.channelId).catch(()
