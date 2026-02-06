// src/systems/ticketThreads.js
// Sistema de tickets baseado em threads + reações.

const { EmbedBuilder, ChannelType } = require('discord.js');
const TicketLog = require('../database/models/TicketLog');
const Ticket = require('../database/models/Ticket');
const { isStaff } = require('../utils/staff');
const { fetchMember } = require('../services/discordFetchCache');

// Emoji a usar para abrir tickets
const OPEN_EMOJI = '🎫';
// Emoji para fechar tickets dentro da thread
const CLOSE_EMOJI = '🔒';

// In-memory debounce to avoid duplicated reaction events creating multiple threads.
// Key: guildId:messageId:userId
const _openDebounce = new Map();
const OPEN_DEBOUNCE_MS = 5000;

function debounceKey(message, user) {
  const guildId = message && message.guild ? message.guild.id : 'noguild';
  const mid = message ? message.id : 'nomsg';
  const uid = user ? user.id : 'nouser';
  return `${guildId}:${mid}:${uid}`;
}

function setDebounce(key) {
  _openDebounce.set(key, Date.now());
  setTimeout(() => {
    const ts = _openDebounce.get(key);
    if (ts && Date.now() - ts >= OPEN_DEBOUNCE_MS) _openDebounce.delete(key);
  }, OPEN_DEBOUNCE_MS + 250).unref?.();
}

/**
 * Cria uma nova thread de ticket a partir da mensagem-base
 * quando alguém reage com o emoji de abertura.
 * @param {impor'discord.js'.MessageReaction} reaction
 * @param {impor'discord.js'.User} user
 */
async function handleTicketOpen(reaction, user) {
  try {
    if (!reaction || !reaction.message) return;
    if (!user || user.bot) return;

    const message = reaction.message;
    const guild = message.guild;
    if (!guild) return;

    const emojiName = reaction.emoji.name || reaction.emoji.id;
    if (!emojiName || emojiName !== OPEN_EMOJI) return;

    // Debounce duplicated reaction events
    const dKey = debounceKey(message, user);
    const lastDebounce = _openDebounce.get(dKey);
    if (lastDebounce && Date.now() - lastDebounce < OPEN_DEBOUNCE_MS) return;
    setDebounce(dKey);

    // If the user already has an open ticket in this guild, do not create another thread.
    // This also prevents "ghost" threads if reaction events are duplicated.
    const existing = await Ticket.findOne({ guildId: guild.id, userId: user.id, status: 'open' })
      .lean()
      .catch(() => null);
    if (existing && existing.channelId) {
      // Try to send a hint message to the existing thread.
      try {
        const ch = await guild.channels.fetch(existing.channelId).catch(() => null);
        if (ch && ch.isThread && ch.isThread()) {
          await ch.send(`ℹ️ ${user}, já tens um ticket aberto aqui.`).catch(() => {});
        }
      } catch (_) {}
      return;
    }

    // Buscar último ticket desta guild para incrementar numeração
    const lastLog = await TicketLog.findOne({ guildId: guild.id })
      .sort({ ticketNumber: -1 })
      .lean();

    const ticketNumber = lastLog ? lastLog.ticketNumber + 1 : 1;
    const ticketName = `ticket-${String(ticketNumber).padStart(3, '0')}`;

    // Criar thread privada no canal (não ligada diretamente à mensagem base)
    const parentChannel = message.channel;
    const thread = await parentChannel.threads.create({
      name: ticketName,
      type: ChannelType.PrivateThread,
      autoArchiveDuration: 1440, // 24h
      reason: `Ticket aberto por ${user.tag || user.id}`
    });

    // Send welcome/control message FIRST, then add member.
    // If Discord emits an "added X" system message, at least the thread isn't empty.

    // Persistir ticket (para dashboard e replies)
    let ticketDoc = null;
    try {
      ticketDoc = await Ticket.create({
        ticketNumber,
        guildId: guild.id,
        channelId: thread.id,
        userId: user.id,
        username: user.username || user.tag || user.id,
        status: 'open',
        createdAt: new Date(),
        lastMessageAt: new Date()
      });
    } catch (e) {
      // If another handler already created an open ticket for this user, avoid leaving an empty/ghost thread.
      if (e && (e.code === 11000 || String(e.message || '').includes('E11000'))) {
        try {
          await thread.send(`ℹ️ ${user}, já existe um ticket aberto. Este tópico será arquivado.`).catch(() => {});
          await thread.setArchived(true, 'Duplicate ticket prevented').catch(() => {});
        } catch (_) {}
        return;
      }
      throw e;
    }

    // Registar log (mantido por compatibilidade, agora com ligações)
    await TicketLog.create({
      ticketNumber,
      ticketId: ticketDoc._id,
      guildId: guild.id,
      channelId: thread.id,
      userId: user.id,
      username: user.username || user.tag || user.id,
      createdAt: new Date()
    });

    // Embed de boas-vindas dentro da thread
    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket de suporte')
      .setDescription(
        [
          `Olá ${user}, obrigado por entrares em contacto com a equipa de suporte.`,
          '',
          '📌 **Antes de começares:**',
          '• Explica de forma clara o teu problema ou pedido;',
          '• Sempre que possível, inclui prints, IDs ou exemplos;',
          '• Evita partilhar dados pessoais sensíveis em texto ou imagem.',
          '',
          `🔒 **Para encerrar este ticket**, reage a esta mensagem com o emoji ${CLOSE_EMOJI}.`,
        ].join('\n')
      )
      .addFields(
        {
          name: 'Número do ticket',
          value: `\`${String(ticketNumber).padStart(3, '0')}\``,
          inline: true
        },
        {
          name: 'Aberto por',
          value: `${user} (\`${user.tag}\`)`,
          inline: true
        }
      )
      .setFooter({ text: `Ticket #${String(ticketNumber).padStart(3, '0')}` })
      .setTimestamp();

    const controlMessage = await thread.send({ embeds: [embed] });

    // Add the user who opened the ticket
    await thread.members.add(user.id).catch(() => {});

    // Adicionar reação de fecho
    await controlMessage.react(CLOSE_EMOJI).catch(() => {});
  } catch (err) {
    console.error('[ticketThreads] handleTicketOpen error:', err);
  }
}

/**
 * Fecha uma thread de ticket quando alguém reage com o emoji de fechar.
 * @param {impor'discord.js'.MessageReaction} reaction
 * @param {impor'discord.js'.User} user
 */
async function handleTicketClose(reaction, user) {
  try {
    const message = reaction.message;
    const channel = message.channel;

    if (!channel || !channel.isThread || !channel.isThread()) return;
    if (!channel.name || !channel.name.startsWith('ticket-')) return;
    if (!user || user.bot) return;

    const guild = channel.guild;
    if (!guild) return;

    const emojiName = reaction.emoji.name || reaction.emoji.id;
    if (!emojiName || emojiName !== CLOSE_EMOJI) return;

    // Verificar permissões
    const member = await fetchMember(guild, user.id);
    if (!member) return;

    const canClose = await isStaff(member).catch(() => false);

    if (!canClose) {
      await channel.send(
        `${user}, não tens permissão para fechar este ticket.`
      ).catch(() => {});
      return;
    }

    // Extrair número do ticket a partir do nome da thread
    const ticketNumberStr = channel.name.replace('ticket-', '');
    const ticketNumber = parseInt(ticketNumberStr, 10);

    const closedAt = new Date();

    if (!Number.isNaN(ticketNumber)) {
      await TicketLog.findOneAndUpdate(
        { guildId: guild.id, ticketNumber },
        {
          $set: {
            closedAt,
            closedById: user.id,
            closedByUsername: user.username || user.tag || user.id
          }
        }
      ).catch(() => {});

      // Update persistent ticket
      await Ticket.findOneAndUpdate(
        { guildId: guild.id, ticketNumber },
        {
          $set: {
            status: 'closed',
            closedAt,
            closedById: user.id,
            closedByUsername: user.username || user.tag || user.id,
            lastMessageAt: closedAt,
            lastResponderId: user.id,
            lastResponderName: user.username || user.tag || user.id,
            lastResponderAt: closedAt
          }
        }
      ).catch(() => {});
    } else {
      // Fallback: locate by channelId
      await Ticket.findOneAndUpdate(
        { guildId: guild.id, channelId: channel.id },
        {
          $set: {
            status: 'closed',
            closedAt,
            closedById: user.id,
            closedByUsername: user.username || user.tag || user.id,
            lastMessageAt: closedAt,
            lastResponderId: user.id,
            lastResponderName: user.username || user.tag || user.id,
            lastResponderAt: closedAt
          }
        }
      ).catch(() => {});
    }

    await channel.send(`🔒 Ticket fechado por ${user}. Obrigado pelo contacto.`)
      .catch(() => {});

    await channel.setLocked(true, 'Ticket encerrado').catch(() => {});
    await channel.setArchived(true, 'Ticket arquivado').catch(() => {});
  } catch (err) {
    console.error('[ticketThreads] handleTicketClose error:', err);
  }
}

module.exports = {
  handleTicketOpen,
  handleTicketClose,
  OPEN_EMOJI,
  CLOSE_EMOJI
};
