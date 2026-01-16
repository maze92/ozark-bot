// src/systems/logger.js

const { EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');
const dashboard = require('../dashboard');

function normalizeActor(actor) {
  if (!actor) return null;

  const u = actor.user ?? actor;
  if (!u?.id) return null;

  return {
    id: u.id,
    tag: u.tag || `${u.username ?? 'Unknown'}#0000`
  };
}

function resolveGuild(guild, user, executor) {
  return guild || user?.guild || executor?.guild || null;
}

function decorateTitle(title) {
  const t = String(title || '').trim();
  const low = t.toLowerCase();

  if (low.includes('warn')) {
    if (low.includes('automatic') || low.includes('automod') || low.includes('auto')) {
      return `🤖⚠️ ${t}`;
    }
    return `⚠️ ${t}`;
  }

  if (low.includes('mute') || low.includes('timeout')) {
    if (low.includes('automatic') || low.includes('automod') || low.includes('auto')) {
      return `🤖🔇 ${t}`;
    }
    return `🔇 ${t}`;
  }

  return t || 'Log';
}

module.exports = async function logger(client, title, user, executor, description, guild) {
  try {
    const resolvedGuild = resolveGuild(guild, user, executor);
    if (!resolvedGuild) return;

    const logChannelName = config.logChannelName || 'log-bot';
    const logChannel =
      resolvedGuild.channels?.cache?.find((ch) => ch?.name === logChannelName) || null;

    const nUser = normalizeActor(user);
    const nExec = normalizeActor(executor);
    const finalTitle = decorateTitle(title);

    let desc = '';
    if (nUser?.tag) desc += `👤 **User:** ${nUser.tag}\n`;
    if (nExec?.tag) desc += `🛠️ **Executor:** ${nExec.tag}\n`;
    if (description) desc += `${description}`;

    const embed = new EmbedBuilder()
      .setTitle(finalTitle || 'Log')
      .setColor('Blue')
      .setDescription(desc || 'No description provided.')
      .setTimestamp(new Date());

    if (logChannel) {
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }

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
