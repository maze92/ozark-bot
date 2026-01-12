const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'serverinfo',
  description: 'Shows information about the server',
  async execute(message, client, args) {
    if (!message.guild) return;

    const { name, id, memberCount, ownerId, createdAt, premiumSubscriptionCount, premiumTier } = message.guild;

    const owner = await message.guild.members.fetch(ownerId).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Server Info: ${name}`)
      .setColor('Blue')
      .addFields(
        { name: 'ID', value: id, inline: true },
        { name: 'Owner', value: owner ? owner.user.tag : 'Unknown', inline: true },
        { name: 'Members', value: `${memberCount}`, inline: true },
        { name: 'Boosts', value: `${premiumSubscriptionCount} (Tier ${premiumTier})`, inline: true },
        { name: 'Created At', value: `<t:${Math.floor(createdAt / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] }).catch(() => null);
  }
};
