/**
 * src/systems/gamenews.js
 * ============================================================
 * Sistema de Game News (RSS)
 *
 * Melhorias implementadas:
 * ✅ 4.1 Dedupe real com lastHashes (últimos N hashes por feed)
 * ✅ 4.2 Backoff por feed (após X erros consecutivos, pausa por Y tempo)
 *
 * Proteções:
 * - started: evita iniciar 2x (duplicar setInterval)
 * - isRunning: evita overlaps (um ciclo não começa se o anterior ainda corre)
 * - 1 notícia por feed por ciclo (evita spam)
 * ============================================================
 */

const Parser = require('rss-parser');
const crypto = require('crypto');
const { EmbedBuilder } = require('discord.js');

const GameNews = require('../database/models/GameNews');
const logger = require('./logger');

// Parser RSS com timeout de segurança
const parser = new Parser({ timeout: 15000 });

// flags globais
let started = false;
let isRunning = false;

/**
 * Gera hash estável para um item do RSS.
 * - Usa guid/id/link se existirem
 * - fallback: title + date
 */
function generateHash(item) {
  const base =
    item.guid ||
    item.id ||
    item.link ||
    `${item.title || ''}-${item.isoDate || item.pubDate || ''}`;

  return crypto.createHash('sha256').update(String(base)).digest('hex');
}

/**
 * Normaliza data do RSS para timestamp do embed.
 */
function getItemDate(item) {
  const d = item.isoDate || item.pubDate;
  const parsed = d ? new Date(d) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
}

/**
 * Busca ou cria record do feed na DB.
 */
async function getOrCreateFeedRecord(feedName) {
  let record = await GameNews.findOne({ source: feedName });

  if (!record) {
    record = await GameNews.create({
      source: feedName,
      lastHashes: [],
      failCount: 0,
      pausedUntil: null
    });
  }

  // compatibilidade (se tinhas lastHash antigo no documento, não quebra)
  // Nota: não “migra” automaticamente para lastHashes (ver nota abaixo)
  if (!Array.isArray(record.lastHashes)) record.lastHashes = [];

  return record;
}

/**
 * Verifica se o feed está pausado por backoff.
 */
function isFeedPaused(record) {
  if (!record?.pausedUntil) return false;
  return record.pausedUntil.getTime() > Date.now();
}

/**
 * Aplica backoff se atingir limite de falhas seguidas.
 */
async function registerFeedFailure(record, cfg) {
  const maxFails = Number(cfg?.gameNews?.backoff?.maxFails ?? 3);
  const pauseMs = Number(cfg?.gameNews?.backoff?.pauseMs ?? 30 * 60 * 1000); // 30 min

  record.failCount = (record.failCount || 0) + 1;

  // atingiu limite → pausa
  if (record.failCount >= maxFails) {
    record.pausedUntil = new Date(Date.now() + pauseMs);
    record.failCount = 0; // reseta depois de pausar (para não ficar preso)
  }

  await record.save();
}

/**
 * Se o feed tiver sucesso, reseta failCount/pausedUntil (se já passou)
 */
async function registerFeedSuccess(record) {
  // Se estava pausado mas já passou, limpa
  if (record.pausedUntil && record.pausedUntil.getTime() <= Date.now()) {
    record.pausedUntil = null;
  }

  if (record.failCount && record.failCount !== 0) {
    record.failCount = 0;
  }

  await record.save();
}

/**
 * Dado items RSS (normalmente do mais novo para o mais antigo),
 * devolve apenas itens que não existem em lastHashes.
 *
 * Nota:
 * - Para não spammar no primeiro arranque, se lastHashes estiver vazio,
 *   devolvemos apenas o mais recente.
 */
function getNewItemsByHashes(items, lastHashes) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const set = new Set(Array.isArray(lastHashes) ? lastHashes : []);

  // Primeiro arranque: não manda 20 coisas
  if (set.size === 0) return [items[0]];

  const newOnes = [];
  for (const it of items) {
    const h = generateHash(it);
    if (!set.has(h)) newOnes.push(it);
  }

  return newOnes;
}

/**
 * Adiciona hash ao array e corta para manter só os últimos N.
 */
function pushHashAndTrim(record, hash, keepN) {
  if (!Array.isArray(record.lastHashes)) record.lastHashes = [];

  // evita duplicados no array
  record.lastHashes = record.lastHashes.filter((h) => h !== hash);

  record.lastHashes.push(hash);

  // mantém só os últimos N
  if (record.lastHashes.length > keepN) {
    record.lastHashes = record.lastHashes.slice(record.lastHashes.length - keepN);
  }
}

/**
 * Envia 1 notícia e atualiza DB (lastHashes).
 */
async function sendOneNewsAndUpdate({ client, feed, channel, record, item, keepN }) {
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

  // Atualiza hashes
  pushHashAndTrim(record, hash, keepN);

  // Sucesso = limpa falhas e pausa expirada
  record.failCount = 0;
  if (record.pausedUntil && record.pausedUntil.getTime() <= Date.now()) {
    record.pausedUntil = null;
  }

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

/**
 * Função principal do sistema.
 * Deve ser chamada UMA vez (no index.js após clientReady).
 */
module.exports = async function gameNewsSystem(client, config) {
  try {
    if (!config?.gameNews?.enabled) return;

    if (started) {
      console.log('[GameNews] Already started. Skipping duplicate start.');
      return;
    }
    started = true;

    // intervalo global
    const intervalMs = Number(config.gameNews.interval ?? 30 * 60 * 1000);
    const safeInterval =
      Number.isFinite(intervalMs) && intervalMs >= 10_000 ? intervalMs : 30 * 60 * 1000;

    // quantos hashes manter por feed
    const keepHashes = Number(config.gameNews.keepHashes ?? 10);
    const safeKeep =
      Number.isFinite(keepHashes) && keepHashes >= 5 && keepHashes <= 50 ? keepHashes : 10;

    console.log('[GameNews] News system started');

    setInterval(async () => {
      // evita overlaps
      if (isRunning) return;
      isRunning = true;

      try {
        const feeds = Array.isArray(config.gameNews.sources) ? config.gameNews.sources : [];
        if (feeds.length === 0) return;

        for (const feed of feeds) {
          const feedName = feed?.name || 'UnknownFeed';

          // 1) record DB do feed
          let record = null;
          try {
            record = await getOrCreateFeedRecord(feedName);
          } catch (err) {
            console.error(`[GameNews] DB error for feed ${feedName}:`, err?.message || err);
            continue;
          }

          // 2) backoff: se feed estiver pausado, ignora
          if (isFeedPaused(record)) {
            // log discreto para não spam
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[GameNews] Feed paused: ${feedName} until ${record.pausedUntil.toISOString()}`);
            }
            continue;
          }

          try {
            // 3) parse do RSS
            const parsed = await parser.parseURL(feed.feed);
            const items = parsed?.items || [];
            if (items.length === 0) {
              // Sem items não conta como falha “grave”
              await registerFeedSuccess(record).catch(() => null);
              continue;
            }

            // 4) canal Discord
            const channel = await client.channels.fetch(feed.channelId).catch(() => null);
            if (!channel) {
              console.warn(`[GameNews] Channel not found: ${feed.channelId} (${feedName})`);
              // canal inválido não deve ativar backoff do feed rss
              await registerFeedSuccess(record).catch(() => null);
              continue;
            }

            // 5) dedupe por hashes recentes
            const newItems = getNewItemsByHashes(items, record.lastHashes);
            if (newItems.length === 0) {
              await registerFeedSuccess(record).catch(() => null);
              continue;
            }

            /**
             * IMPORTANTE:
             * items do RSS vem do mais novo -> mais antigo.
             * Para manter ordem sem spam:
             * - enviamos 1 por ciclo
             * - escolhemos o MAIS ANTIGO dos novos (último do array)
             */
            const itemToSend = newItems[newItems.length - 1];

            if (!itemToSend?.title || !itemToSend?.link) {
              // item malformado: não conta como falha do feed
              await registerFeedSuccess(record).catch(() => null);
              continue;
            }

            // 6) envia e atualiza hashes
            await sendOneNewsAndUpdate({
              client,
              feed,
              channel,
              record,
              item: itemToSend,
              keepN: safeKeep
            });

          } catch (err) {
            // erro no feed (parseURL costuma dar esses “Received one or more errors”)
            console.error(`[GameNews] Error processing feed ${feedName}:`, err?.message || err);

            // regista falha e aplica backoff se necessário
            try {
              await registerFeedFailure(record, config);

              // se entrou em pausa, loga uma vez
              if (record.pausedUntil && record.pausedUntil.getTime() > Date.now()) {
                console.warn(
                  `[GameNews] Feed "${feedName}" paused until ${record.pausedUntil.toISOString()} (backoff).`
                );
              }
            } catch (e) {
              console.error(`[GameNews] Failed updating failure/backoff for ${feedName}:`, e?.message || e);
            }
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
