const { EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');
const dashboard = require('../dashboard');

/**
 * Logger centralizado
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

    let desc = '';
    if (user) desc += `👤 **User:** ${user.tag}\n`;
    if (executor) desc += `🛠️ **Executor:** ${executor.tag}\n`;
    if (description) desc += `${description}`;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor('Blue')
      .setDescription(desc)
      .setTimestamp();

    // Discord log
    if (logChannel) {
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }

    // Dashboard log (CORRETO)
    dashboard.sendToDashboard('log', {
      title,
      user: user ? {
        id: user.id,
        tag: user.tag
      } : null,
      executor: executor ? {
        id: executor.id,
        tag: executor.tag
      } : null,
      description,
      guild: {
        id: guild.id,
        name: guild.name
      }
    });

  } catch (err) {
    console.error('[Logger] Error:', err);
  }
};
