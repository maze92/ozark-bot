// src/slash/unmute.js

const { PermissionsBitField } = require('discord.js');
const config = require('../config/defaultConfig');
const logger = require('../systems/logger');
const warningsService = require('../systems/warningsService');
const { t } = require('../systems/i18n');

function isStaff(member) {
  if (!member) return false;

  const isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator);
  if (isAdmin) return true;

  const staffRoles = Array.isArray(config.staffRoles) ? config.staffRoles : [];
  if (!staffRoles.length) return false;

  return member.roles?.cache?.some((r) => staffRoles.includes(r.id));
}

module.exports = async (client, interaction) => {
  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  try {
    const guild = interaction.guild;
    const executor = interaction.member;
    if (!guild || !executor) return;

    const botMember = guild.members.me;
    if (!botMember) return;

    // staff check
    if (!isStaff(executor)) {
      return interaction.editReply({ content: t('common.noPermission') }).catch(() => null);
    }

    // bot permissions
    const perms = interaction.channel?.permissionsFor?.(botMember);
    if (!perms?.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.editReply({ content: t('mute.missingPerm') }).catch(() => null);
    }

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason')?.trim() || t('common.noReason');

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.editReply({ content: '❌ Could not resolve target.' }).catch(() => null);
    }

    if (targetMember.id === interaction.user.id) {
      return interaction.editReply({ content: '❌ You cannot unmute yourself.' }).catch(() => null);
    }

    if (targetMember.id === client.user.id) {
      return interaction.editReply({ content: '❌ You cannot unmute the bot.' }).catch(() => null);
    }

    const executorIsAdmin = executor.permissions.has(PermissionsBitField.Flags.Administrator);

    if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
      return interaction
        .editReply({
          content:
            '❌ I cannot unmute this user (their role is higher or equal to my highest role).'
        })
        .catch(() => null);
    }

    if (!executorIsAdmin && targetMember.roles.highest.position >= executor.roles.highest.position) {
      return interaction
        .editReply({
          content: '❌ You cannot unmute a user with an equal or higher role than yours.'
        })
        .catch(() => null);
    }

    if (
      typeof targetMember.isCommunicationDisabled === 'function' &&
      !targetMember.isCommunicationDisabled()
    ) {
      return interaction
        .editReply({ content: t('unmute.notMuted', null, targetMember.user.tag) })
        .catch(() => null);
    }

    // unmute
    await targetMember.timeout(null, `Unmuted by ${interaction.user.tag}: ${reason}`);

    // feedback (ephemeral)
    await interaction
      .editReply({ content: t('unmute.success', null, targetMember.user.tag) })
      .catch(() => null);

    // fetch db user (for log only)
    let dbUser = null;
    try {
      dbUser = await warningsService.getOrCreateUser(guild.id, targetMember.id);
    } catch {
      // ignore
    }

    const trustText = dbUser?.trust != null ? `\nTrust: **${dbUser.trust}**` : '';
    const warnsText = dbUser?.warnings != null ? `\nWarnings: **${dbUser.warnings}**` : '';

    await logger(
      client,
      'Slash Unmute',
      targetMember.user,
      interaction.user,
      `User unmuted manually.\nReason: **${reason}**${warnsText}${trustText}`,
      guild
    );
  } catch (err) {
    console.error('[slash/unmute] Error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: t('unmute.failed') }).catch(() => null);
    }
  }
};
