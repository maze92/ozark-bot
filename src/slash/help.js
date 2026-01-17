// src/slash/help.js

const { EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');
const { t } = require('../systems/i18n');

module.exports = async (client, interaction) => {
  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  const prefix = config.prefix || '!';

  const embed = new EmbedBuilder()
    .setTitle(t('help.title'))
    .setColor('Blue')
    .addFields(
      {
        name: t('help.moderationTitle'),
        value: t('help.moderation', null, prefix).join('\n'),
        inline: false
      },
      {
        name: t('help.automodTitle'),
        value: t('help.automod').join('\n'),
        inline: false
      },
      {
        name: t('help.gameNewsTitle'),
        value: t('help.gameNews').join('\n'),
        inline: false
      },
      {
        name: t('help.dashboardTitle'),
        value: t('help.dashboard').join('\n'),
        inline: false
      }
    )
    .setFooter({ text: t('help.footer', null, prefix) });

  return interaction.editReply({ embeds: [embed] }).catch(() => null);
};
