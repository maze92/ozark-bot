/**
 * src/systems/gamenews.js
 * ============================================================
 * GameNews (RSS)
 * - lê feeds RSS
 * - deteta novas notícias usando histórico de hashes (últimos N)
 * - envia 1 notícia por feed por intervalo (evita spam)
 * - envia sempre a mais antiga das novas (mantém ordem)
 * ============================================================
 */

const Parser = require('rss-parser');
const crypto = require('crypto');
const { EmbedBuilder } = require('discord.js');

const GameNews = require('../database/models/GameNews');
const logger = require('./logger');

const parser = new Parser({ timeout: 15000 });

let started = false;
let isRunning = false;

function generateHash(item) {
  const base =
    item.guid ||
    item.id ||
    item.link ||
    `${item.title || ''}-${item.pubDate || item.isoDate || ''}`;

  return crypto.createHash('sha256').update(String(base)).digest('hex');
}

function getItemDate(item) {
  const d = item.isoDate || item.pubDate;
  const parsed = d ? new Date(d) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
}

async function getOrCreateFeedRecord(feedName) {
  let record = await GameNews.findOne({ source: feedName });

  if (!record) {
    record = await GameNews.create({ source: feedName, lastHash: null, lastHashes: [] });
  }

  // migração: se só existia lastHash antigo, colocar no histórico
  if (record.lastHash && (!Array.isArray(record.lastHashes) || record.lastHashes.length === 0)) {
    record.lastHashes = [record.lastHash];
    await record.save().catch(() => null);
  }

  if (!Array.isArray(record.lastHashes)) {
    record.lastHashes = [];
    await record.save().catch(() => null);
  }

  return record;
}

function getNewItemsSinceLast(items, lastHashes) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const history = Array.isArray(lastHashes) ? lastHashes : [];

  // primeiro arranque: enviar só o mais recente
  if (history.length === 0) return [items[0]];

  const newItems = [];
  for (const it of items) {
    const h = generateHash(it);
    if (history.includes(h)) break;
    newItems.push(it);
  }

  return newItems;
}

async function sendOneNewsAndUpdate({ client, feed, channel, record, item, maxHistory }) {
  const hash = generateHash(item);

  const embed = new EmbedBuilder()
    .setTitle(item.title || 'New article')
    .setURL(item.link || null)
    .setDescription(item.contentSnippet || item.content || 'No description available.')
    .setColor(0xe60012)
    .setFooter({ text: feed.name })
    .setTimestamp(getItemDate(item));

  if (item.enclosure?.url) embed.setThumbnail(item.enclosure.url);

  await channel.send({ embeds: [embed] });

  // atualizar histórico (unshift + dedupe + trim)
  const history = Array.isArray(record.lastHashes) ? record.lastHashes : [];

  const next = [hash, ...history.filter(h => h !== hash)];
  record.lastHashes = next.slice(0, maxHistory);

  // compatibilidade: manter lastHash como o mais recente enviado
  record.lastHash = hash;

  await record.save();

  await logger(
    client,
    'Game News',
    null,
    client.user,
    `Sent: **${feed.name}** -> **${item.title || 'Untitled'}**`,
    channel.guild
  );

  console.log(`[GameNews] Sent: ${feed.name} -> ${item.title}`);
}

module.exports = async function gameNewsSystem(client, config) {
  try {
    if (!config?.gameNews?.enabled) return;

    if (started) {
      console.log('[GameNews] Already started. Skipping duplicate start.');
      return;
    }
    started = true;

    const intervalMs = Number(config.gameNews.interval ?? 30 * 60 * 1000);
    const safeInterval = Number.isFinite(intervalMs) && intervalMs >= 10_000 ? intervalMs : 30 * 60 * 1000;

    const maxHistory = Number(config.gameNews.hashHistorySize ?? 10);
    const safeHistory = Number.isFinite(maxHistory) && maxHistory >= 3 ? maxHistory : 10;

    console.log('[GameNews] News system started');

    setInterval(async () => {
      if (isRunning) return;
      isRunning = true;

      try {
        for (const feed of config.gameNews.sources || []) {
          try {
            const parsed = await parser.parseURL(feed.feed);
            const items = parsed?.items || [];
            if (items.length === 0) continue;

            const channel = await client.channels.fetch(feed.channelId).catch(() => null);
            if (!channel) {
              console.warn(`[GameNews] Channel not found: ${feed.channelId} (${feed.name})`);
              continue;
            }

            const record = await getOrCreateFeedRecord(feed.name);

            const newItems = getNewItemsSinceLast(items, record.lastHashes);
            if (newItems.length === 0) continue;

            // enviar o MAIS ANTIGO dos novos (último do array)
            const itemToSend = newItems[newItems.length - 1];
            if (!itemToSend?.title || !itemToSend?.link) continue;

            await sendOneNewsAndUpdate({
              client,
              feed,
              channel,
              record,
              item: itemToSend,
              maxHistory: safeHistory
            });

          } catch (err) {
            console.error(`[GameNews] Error processing feed ${feed?.name}:`, err?.message || err);
          }
        }
      } finally {
        isRunning = false;
      }
    }, safeInterval);

  } catch (err) {
    console.error('[GameNews] Critical error starting system:', err);
  }
};
