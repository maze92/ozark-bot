// src/slash/help.js

const config = require('../config/defaultConfig');
const { t } = require('../systems/i18n');
const { getGuildLanguage } = require('../systems/langService');
const { replyEphemeral } = require('../utils/discord');
const { safeReply } = require('../utils/discord');

module.exports = async function helpSlash(_client, interaction) {
  try {
    const guild = interaction.guild;
    const lang = await getGuildLanguage(guild && guild.id);
    const member = interaction.member;

    if (!guild || !member) {
      return replyEphemeral(
        interaction,
        t('common.guildOnly', lang)
      );
    }

    const { canUseTicketOrHelp } = require('./utils');
    if (!canUseTicketOrHelp(member)) {
      return replyEphemeral(
        interaction,
        t('common.noPermission', lang)
      );
    }

    const prefix = config.prefix || '!';
    const lines = [];

    lines.push(`**${t('help.title', lang)}**`);
    lines.push('');

    lines.push(`__${t('help.moderationTitle', lang)}__`);
    lines.push(...t('help.moderation', lang, prefix));
    lines.push('');

    lines.push(`__${t('help.automodTitle', lang)}__`);
    lines.push(...t('help.automod', lang));
    lines.push('');

    lines.push(`__${t('help.gameNewsTitle', lang)}__`);
    lines.push(...t('help.gameNews', lang));
    lines.push('');

    lines.push(`__${t('help.dashboardTitle', lang)}__`);
    lines.push(...t('help.dashboard', lang));
    lines.push('');

    lines.push(t('help.footer', lang, prefix));

    await replyEphemeral(interaction, lines.join('\n'));
  } catch (err) {
    console.error('[slash/help] Error:', err);
    return safeReply(interaction, { content: t('common.unexpectedError', lang) }, { ephemeral: true });
  }
};
