// src/systems/gamenews.js
// ============================================================
// Sistema de Game News (RSS)
//
// Faz:
// - Lê feeds RSS configurados
// - Envia notícias novas para canais do Discord
// - Evita reposts guardando lastLink por feed no MongoDB
//
// Importante:
// - Este ficheiro deve ser iniciado APENAS UMA vez no bot.
// - Se estiver a iniciar em mais do que um sítio ou em cluster,
//   vais ter duplicados.
// ============================================================

const Parser = require('rss-parser');
const { EmbedBuilder } = require('discord.js');
const GameNews = require('../database/models/GameNews');
const logger = require('./logger');

const parser = new Parser({
  timeout: 15000
});

// Guard interno para impedir duplicar intervalos no mesmo processo
let started = false;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Normaliza a data de um item RSS
 * @param {Object} item
 * @returns {number} timestamp ms
 */
function getItemTime(item) {
  const d =
    item?.isoDate ||
    item?.pubDate ||
    item?.published ||
    item?.date ||
    null;

  const t = d ? new Date(d).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Envia um embed no canal do Discord
 * @param {TextChannel} channel
 * @param {Object} feed
 * @param {Object} item
 */
async function sendNewsEmbed(channel, feed, item) {
  const embed = new EmbedBuilder()
    .setTitle(item.title || 'Untitled')
    .setURL(item.link)
    .setDescription(item.contentSnippet || 'No description available')
    .setColor(0xe60012)
    .setFooter({ text: feed.name })
    .setTimestamp(new Date(getItemTime(item) || Date.now()));

  if (item.enclosure?.url) embed.setThumbnail(item.enclosure.url);

  await channel.send({ embeds: [embed] });
}

/**
 * Processa 1 feed: decide o que enviar e atualiza lastLink
 * @param {Client} client
 * @param {Object} feed
 */
async function processFeed(client, feed) {
  // 1) Ler RSS
  const parsed = await parser.parseURL(feed.feed);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  if (items.length === 0) return;

  // 2) Filtrar items com link válido
  const valid = items.filter(i => i?.link && i?.title);

  if (valid.length === 0) return;

  // 3) Ordenar do mais recente para o mais antigo (reduz bugs)
  valid.sort((a, b) => getItemTime(b) - getItemTime(a));

  // 4) Buscar record do DB (estado do feed)
  let record = await GameNews.findOne({ source: feed.name });

  if (!record) {
    record = await GameNews.create({
      source: feed.name,
      lastLink: null
    });
  }

  const lastLink = record.lastLink;

  // 5) Determinar o que é novo:
  // - vamos enviar tudo até encontrar o lastLink
  const toSend = [];
  for (const item of valid) {
    if (lastLink && item.link === lastLink) break;
    toSend.push(item);
  }

  // Se nada novo, termina
  if (toSend.length === 0) return;

  // 6) Buscar o canal de destino
  const channel = await client.channels.fetch(feed.channelId).catch(() => null);
  if (!channel) {
    console.warn(`[GameNews] Channel not found: ${feed.channelId} (${feed.name})`);
    return;
  }

  // 7) Enviar do mais antigo para o mais recente (fica bonito no canal)
  toSend.reverse();

  // Segurança: limita quantas manda por ciclo (evita spam num “primeiro arranque”)
  const maxPerRun = 3; // ajusta se quiseres mais/menos
  const batch = toSend.slice(-maxPerRun);

  for (const item of batch) {
    await sendNewsEmbed(channel, feed, item);

    // Log (Discord + Dashboard)
    await logger(
      client,
      'Game News',
      client.user,
      client.user,
      `Sent: ${feed.name} -> **${item.title}**`,
      channel.guild
    );

    console.log(`[GameNews] Sent: ${feed.name} -> ${item.title}`);
  }

  // 8) Atualizar lastLink para o MAIS RECENTE que enviámos
  // O mais recente enviado é o último item do batch
  const newestSent = batch[batch.length - 1];
  record.lastLink = newestSent.link;
  await record.save();
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

module.exports = async (client, config) => {
  if (!config.gameNews?.enabled) return;

  // Evita arrancar duas vezes no mesmo processo
  if (started) {
    console.warn('[GameNews] Already started (skipping).');
    return;
  }
  started = true;

  console.log('[GameNews] News system started');

  const intervalMs = Number(config.gameNews.interval ?? 30 * 60 * 1000);

  // Função de ciclo
  const tick = async () => {
    for (const feed of config.gameNews.sources || []) {
      try {
        await processFeed(client, feed);
      } catch (err) {
        console.error(`[GameNews] Error processing feed ${feed.name}:`, err?.message || err);
      }
    }
  };

  // Faz 1 tick inicial (opcional)
  await tick();

  // Agenda ticks
  setInterval(tick, intervalMs);
};
