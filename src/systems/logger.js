// src/systems/logger.js

/**
 * v.1.0.0.1
 * ------------------------------------------------------------
 * Resumo:
 * - Sistema centralizado de logging do bot
 * - Envia logs para canal Discord e Dashboard
 * - Persiste logs via dashboard.js
 *
 * Notas:
 * - Normaliza User/GuildMember
 * - Não bloqueia execução em falhas de log
 * ------------------------------------------------------------
 */

const { EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');
const dashboard = require('../dashboard');

function normalizeActor(actor) {
  if (!actor) return null;

  const u = actor.user ?? actor; // se for member, u = member.user
  if (!u?.id) return null;

  return {
    id: u.id,
    tag: u.tag || `${u.username ?? 'Unknown'}#0000`
  };
}

// * resolve guild com segurança
function resolveGuild(guild, user, executor) {
  return guild || user?.guild || executor?.guild || null;
}

// * aplica um "prefixo" visual ao título baseado no tipo
function decorateTitle(title) {
  const t = String(title || '').trim();
  const low = t.toLowerCase();

  // warn
  if (low.includes('warn')) {
    // automatic
    if (low.includes('automatic') || low.includes('automod') || low.includes('auto')) {
      return `🤖⚠️ ${t}`;
    }
    // manual
    return `⚠️ ${t}`;
  }

  // mute
  if (low.includes('mute') || low.includes('timeout')) {
    if (low.includes('automatic') || low.includes('automod') || low.includes('auto')) {
      return `🤖🔇 ${t}`;
    }
    return `🔇 ${t}`;
  }

  // outros: não mexe
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

    // canal de logs
    const logChannelName = config.logChannelName || 'log-bot';
    const logChannel =
      resolvedGuild.channels?.cache?.find((ch) => ch?.name === logChannelName) || null;

    const nUser = normalizeActor(user);
    const nExec = normalizeActor(executor);

    // título com emoji
    const finalTitle = decorateTitle(title);

    // embed description
    let desc = '';
    if (nUser?.tag) desc += `👤 **User:** ${nUser.tag}\n`;
    if (nExec?.tag) desc += `🛠️ **Executor:** ${nExec.tag}\n`;
    if (description) desc += `${description}`;

    const embed = new EmbedBuilder()
      .setTitle(finalTitle || 'Log')
      .setColor('Blue')
      .setDescription(desc || 'No description provided.')
      .setTimestamp(new Date());

    // discord log-bot
    if (logChannel) {
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }

    // dashboard (tempo real + persistência via dashboard.js)
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
