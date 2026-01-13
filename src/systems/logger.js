const { EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');

/**
 * Logger centralizado
 * @param {Client} client
 * @param {string} title
 * @param {User|null} user
 * @param {User|null} executor
 * @param {string} description
 * @param {Guild|null} guild
 */
module.exports = async function logger(
  client,
  title,
  user = null,
  executor = null,
  description = '',
  guild = null
) {
  try {
    if (!guild && executor?.guild) guild = executor.guild;
    if (!guild && user?.guild) guild = user.guild;
    if (!guild) return;

    const logChannelName = config.logChannelName || 'log-bot';
    const logChannel = guild.channels.cache.find(
      ch => ch.name === logChannelName
    );

    if (!logChannel) return;

    let desc = '';
    if (user) desc += `👤 **User:** ${user.tag}\n`;
    if (executor) desc += `🛠️ **Executor:** ${executor.tag}\n`;
    if (description) desc += `\n${description}`;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(desc)
      .setColor(0x5865f2)
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[LOGGER ERROR]', err);
  }
};
