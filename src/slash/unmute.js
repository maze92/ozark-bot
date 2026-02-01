// src/slash/unmute.js

const { PermissionsBitField } = require('discord.js');

const logger = require('../systems/logger');
const warningsService = require('../systems/warningsService');
const { t } = require('../systems/i18n');
const { getGuildLanguage } = require('../systems/langService');
const { isStaff } = require('./utils');
const { replyEphemeral, safeReply } = require('../utils/discord');
const { ensureUnmutePermissions } = require('../utils/modPermissions');

module.exports = async function unmuteSlash(client, interaction) {
  try {
    if (!interaction?.guild) return;

    const guild = interaction.guild;
    const lang = await getGuildLanguage(guild && guild.id);
    const executor = interaction.member;
    const botMember = guild.members.me;

    if (!executor || !botMember) {
      return replyEphemeral(interaction, t('common.unexpectedError', lang));
    }

    if (!(await isStaff(executor))) {
      return replyEphemeral(interaction, t('common.noPermission', lang));
    }

    const channelPerms = interaction.channel?.permissionsFor?.(botMember);
    if (!channelPerms?.has(PermissionsBitField.Flags.ModerateMembers)) {
      return replyEphemeral(
        interaction,
        t('common.missingBotPerm', lang, 'Moderate Members')
      );
    }

    const targetUser = interaction.options.getUser('user', true);
    const target = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!target) {
      return replyEphemeral(interaction, t('common.cannotResolveUser', lang));
    }

    const canProceed = await ensureUnmutePermissions({ client, interaction, executor, target, botMember });
    if (!canProceed) return;

    if (typeof target.isCommunicationDisabled === 'function' && !target.isCommunicationDisabled()) {
      return replyEphemeral(
        interaction,
        t('unmute.notMuted', lang, { tag: target.user.tag })
      );
    }

    await target.timeout(null, `Unmuted by ${interaction.user.tag}`);

    // Resposta pública (default)
    await interaction
      .reply({ content: t('unmute.success', lang, { tag: target.user.tag }) })
      .catch(() => null);

    let dbUser = null;
    try {
      dbUser = await warningsService.getOrCreateUser(guild.id, target.id);
    } catch {
      // ignore
    }

    await logger(
      client,
      'Slash Unmute',
      target.user,
      interaction.user,
      t('log.actions.manualUnmute', lang, {
        warnings: dbUser?.warnings ?? 0,
        trust: dbUser?.trust ?? 'N/A'
      }),
      guild
    );
  } catch (err) {
    console.error('[slash/unmute] Error:', err);
    return safeReply(interaction, { content: t('unmute.failed', lang) }, { ephemeral: true });
  }
};