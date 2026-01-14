const { EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');
const dashboard = require('../dashboard');

/**
 * Centralized logger
 * Sends logs to Discord and Dashboard
 */
module.exports = async function logger(
  client,
  title,
  user,
  executor,
  description,
  guild
) {
  try {
    guild = guild || user?.guild;
    if (!guild) return;

    const logChannelName = config.logChannelName || 'log-bot';
    const logChannel = guild.channels.cache.find(
      ch => ch.name === logChannelName
    );

    // Build embed
    let desc = '';
    if (user) desc += `👤 **User:** ${user.tag}\n`;
    if (executor) desc += `🛠️ **Executor:** ${executor.tag}\n`;
    if (description) desc += `${description}`;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x3498db)
      .setDescription(desc)
      .setTimestamp();

    if (logChannel) {
      logChannel.send({ embeds: [embed] }).catch(() => null);
    }

    // Send to dashboard
    dashboard.sendToDashboard('log', {
      title,
      user: user?.tag || null,
      executor: executor?.tag || null,
      description,
      time: Date.now()
    });

  } catch (err) {
    console.error('[Logger] Error:', err);
  }
};
