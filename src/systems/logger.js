// src/systems/logger.js
// ============================================================
// Logger centralizado
// Faz:
// - Envia logs para o canal "log-bot" (ou o nome definido no config)
// - Envia logs em tempo real para o Dashboard via Socket.IO
// - (Agora) o dashboard persiste no MongoDB
//
// UX Upgrade (Ponto 4):
// ✅ Padroniza títulos com emojis, sem mudar lógica do bot
//    Exemplos:
//    - "Manual Warn"     -> "⚠️ Manual Warn"
//    - "Automatic Warn"  -> "🤖⚠️ Automatic Warn"
//    - "Manual Mute"     -> "🔇 Manual Mute"
//    - "Automatic Mute"  -> "🤖🔇 Automatic Mute"
//
// Notas:
// - "User" (discord.js) NÃO tem .guild
// - "GuildMember" TEM .guild
// - Por isso normalizamos tudo aqui
// ============================================================

const { EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');
const dashboard = require('../dashboard');

/**
 * Normaliza "actor" para {id, tag}
 * Aceita:
 * - User
 * - GuildMember
 * - null
 */
function normalizeActor(actor) {
  if (!actor) return null;

  const u = actor.user ?? actor; // se for member, u = member.user
  if (!u?.id) return null;

  return {
    id: u.id,
    tag: u.tag || `${u.username ?? 'Unknown'}#0000`
  };
}

/**
 * Resolve guild com segurança
 */
function resolveGuild(guild, user, executor) {
  return guild || user?.guild || executor?.guild || null;
}

/**
 * Aplica um "prefixo" visual ao título, baseado no tipo.
 * - Não muda o conteúdo do log, só melhora leitura.
 */
function decorateTitle(title) {
  const t = String(title || '').trim();
  const low = t.toLowerCase();

  // ⚠️ Warn
  if (low.includes('warn')) {
    // Automatic -> 🤖⚠️
    if (low.includes('automatic') || low.includes('automod') || low.includes('auto')) {
      return `🤖⚠️ ${t}`;
    }
    // Manual -> ⚠️
    return `⚠️ ${t}`;
  }

  // 🔇 Mute
  if (low.includes('mute') || low.includes('timeout')) {
    if (low.includes('automatic') || low.includes('automod') || low.includes('auto')) {
      return `🤖🔇 ${t}`;
    }
    return `🔇 ${t}`;
  }

  // Outros: não mexe
  return t || 'Log';
}

/**
 * Logger centralizado
 * @param {Client} client
 * @param {string} title
 * @param {User|GuildMember|null} user
 * @param {User|GuildMember|null} executor
 * @param {string} description
 * @param {Guild|null} guild
 */
module.exports = async function logger(client, title, user, executor, description, guild) {
  try {
    const resolvedGuild = resolveGuild(guild, user, executor);
    if (!resolvedGuild) return;

    // Canal de logs
    const logChannelName = config.logChannelName || 'log-bot';
    const logChannel =
      resolvedGuild.channels?.cache?.find((ch) => ch?.name === logChannelName) || null;

    const nUser = normalizeActor(user);
    const nExec = normalizeActor(executor);

    // --------------------------------------------------------
    // UX: título com emoji (Ponto 4)
    // --------------------------------------------------------
    const finalTitle = decorateTitle(title);

    // Embed description
    let desc = '';
    if (nUser?.tag) desc += `👤 **User:** ${nUser.tag}\n`;
    if (nExec?.tag) desc += `🛠️ **Executor:** ${nExec.tag}\n`;
    if (description) desc += `${description}`;

    const embed = new EmbedBuilder()
      .setTitle(finalTitle || 'Log')
      .setColor('Blue')
      .setDescription(desc || 'No description provided.')
      .setTimestamp(new Date());

    // 1) Discord log-bot
    if (logChannel) {
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }

    // 2) Dashboard (tempo real + persistência via dashboard.js)
    // Nota: no dashboard guardamos o "title" já decorado, para bater certo com UI.
    if (dashboard?.sendToDashboard) {
      dashboard.sendToDashboard('log', {
        title: finalTitle || 'Log',
        user: nUser,
        executor: nExec,
        description: description || '',
        guild: { id: resolvedGuild.id, name: resolvedGuild.name },
        time: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('[Logger] Error:', err);
  }
};
