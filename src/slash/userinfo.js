// src/slash/userinfo.js

const { EmbedBuilder, PermissionsBitField } = require('discord.js');

const config = require('../config/defaultConfig');
const warningsService = require('../systems/warningsService');
const Infraction = require('../database/models/Infraction');
const logger = require('../systems/logger');
const { t } = require('../systems/i18n');
const { getGuildLanguage } = require('../systems/langService');
const { isStaff } = require('./utils');
const { getTrustConfig, getTrustLabel } = require('../utils/trust');
const { replyEphemeral, safeReply } = require('../utils/discord');

function truncate(str, max = 90) {
  const s = String(str || '').trim();
  if (!s) return t('common.noReason', lang);
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}

function formatRelativeTime(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return `<t:${Math.floor(d.getTime() / 1000)}:R>`;
}

function formatInfractionLine(inf) {
  const type = String(inf?.type || 'UNKNOWN').toUpperCase();
  const duration =
    inf?.duration != null && Number.isFinite(Number(inf.duration)) && Number(inf.duration) > 0
      ? ` • ${Math.round(Number(inf.duration) / 60000)}m`
      : '';

  const ts = formatRelativeTime(inf?.createdAt);
  const reason = truncate(inf?.reason || t('common.noReason', lang), 80);

  return `• **${type}**${duration} — ${ts}\n  └ ${reason}`;
}

function joinFieldSafe(lines, maxLen = 1024) {
  const out = [];
  let total = 0;

  for (const line of lines) {
    const s = String(line);
    const add = (out.length ? 1 : 0) + s.length;
    if (total + add > maxLen) break;
    out.push(s);
    total += add;
  }

  if (lines.length > out.length) {
    const ell = '…';
    if (total + (out.length ? 1 : 0) + ell.length <= maxLen) out.push(ell);
  }

  return out.join('\n') || t('userinfo.noRecentInfractions', lang);
}

module.exports = async function userinfoSlash(client, interaction) {
  try {
    if (!interaction?.guild) return;

    const guild = interaction.guild;
    const lang = await getGuildLanguage(guild && guild.id);
    const trustCfg = getTrustConfig();
    const requesterIsStaff = await isStaff(interaction.member);

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member?.user) {
      return replyEphemeral(interaction, t('common.cannotResolveUser', lang));
    }

    const user = member.user;
    const dbUser = await warningsService.getOrCreateUser(guild.id, user.id);

    const warnings = dbUser?.warnings ?? 0;
    const trustValue = Number.isFinite(dbUser?.trust) ? dbUser.trust : trustCfg.base;
    const trustLabel = getTrustLabel(trustValue, trustCfg);

    let infractionsCount = 0;
    try {
      infractionsCount = await Infraction.countDocuments({ guildId: guild.id, userId: user.id });
    } catch {
      // ignore
    }

    let recentInfractions = [];
    if (requesterIsStaff) {
      try {
        recentInfractions = await Infraction.find({ guildId: guild.id, userId: user.id })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
      } catch {
        recentInfractions = [];
      }
    }

    const createdAt = user.createdAt
      ? `<t:${Math.floor(user.createdAt.getTime() / 1000)}:F>`
      : 'Unknown';

    const joinedAt = member.joinedAt
      ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`
      : 'Unknown';

    let trustFieldValue = t('userinfo.trustDisabled', lang);
    if (trustCfg.enabled) {
      trustFieldValue = requesterIsStaff
        ? t('userinfo.trustStaff', lang, { trustValue, trustMax: trustCfg.max, trustLabel })
        : t('userinfo.trustPublic', lang);
    }

    let recentFieldValue = t('userinfo.recentStaffOnly', lang);
    if (requesterIsStaff) {
      const lines = (recentInfractions || []).map(formatInfractionLine);
      recentFieldValue = joinFieldSafe(lines, 1024);
    }

    const embed = new EmbedBuilder()
      .setTitle(t('userinfo.title', lang, { tag: user.tag }))
      .setColor('Blue')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: t('userinfo.fieldUser', lang),
          value: t('userinfo.tagAndId', lang, { tag: user.tag, id: user.id }),
          inline: false
        },
        {
          name: t('userinfo.fieldAccount', lang),
          value: t('userinfo.accountDates', lang, { createdAt, joinedAt }),
          inline: false
        },
        {
          name: t('userinfo.fieldWarnings', lang),
          value: t('userinfo.warningsBlock', lang, {
            warnings,
            maxWarnings: config.maxWarnings ?? 3,
            infractionsCount
          }),
          inline: false
        },
        {
          name: t('userinfo.fieldTrust', lang),
          value: trustFieldValue,
          inline: false
        },
        {
          name: t('userinfo.fieldRecent', lang),
          value: recentFieldValue,
          inline: false
        }
      )
      .setFooter({ text: t('userinfo.requestedBy', lang, { tag: interaction.user.tag }) })
      .setTimestamp(new Date());

    // Resposta pública (sem ephemeral)
    await interaction.reply({ embeds: [embed] }).catch(() => null);

    await logger(
      client,
      'Slash User Info',
      user,
      interaction.user,
      t('log.actions.userinfo', lang, {
        tag: user.tag,
        id: user.id,
        warnings,
        maxWarnings: config.maxWarnings ?? 3,
        infractionsCount,
        trust: trustCfg.enabled ? `${trustValue}/${trustCfg.max}` : 'N/A',
        riskLabel: trustCfg.enabled ? trustLabel : 'N/A'
      }),
      guild
    );
  } catch (err) {
    console.error('[slash/userinfo] Error:', err);
    return safeReply(interaction, { content: t('common.unexpectedError', lang) }, { ephemeral: true });
  }
};

