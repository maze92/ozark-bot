// src/commands/userinfo.js
// ============================================================
// Comando: !userinfo
// ------------------------------------------------------------
// O que faz:
// - Mostra informação de moderação de um utilizador na guild:
//   • Warnings atuais
//   • Trust score (0-100) + label (Low/Medium/High risk)
//   • Última infração (se houver dados)
//   • Estado de mute (timeout ativo ou não)
// - Mostra também info básica do Discord:
//   • ID, tag, data de criação, data de entrada na guild
//
// Permissões:
// - Restrito a staff (config.staffRoles via allowedRoles)
// - O systems/commands.js trata da verificação de allowedRoles
// ============================================================

const { EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');

const warningsService = require('../systems/warningsService');
const logger = require('../systems/logger');

// ------------------------------------------------------------
// Helper para ler config.trust com defaults seguros
// (apenas leitura – quem altera trust é o warningsService)
// ------------------------------------------------------------
function getTrustConfig() {
  const cfg = config.trust || {};

  return {
    enabled: cfg.enabled !== false,   // por defeito: ligado

    base: cfg.base ?? 30,
    min: cfg.min ?? 0,
    max: cfg.max ?? 100,

    lowThreshold: cfg.lowThreshold ?? 10,       // <= isto → risco alto
    highThreshold: cfg.highThreshold ?? 60      // >= isto → risco baixo
  };
}

/**
 * Devolve um label amigável para o trust:
 * - ex: 🔴 Low (High risk)
 */
function getTrustLabel(trustValue, trustCfg) {
  if (!trustCfg.enabled) {
    return {
      text: 'Trust system disabled',
      emoji: '⚪',
      color: 0x808080
    };
  }

  const t = Number.isFinite(trustValue) ? trustValue : trustCfg.base;

  if (t <= trustCfg.lowThreshold) {
    return {
      text: 'Low (High risk)',
      emoji: '🔴',
      color: 0xff5555
    };
  }

  if (t >= trustCfg.highThreshold) {
    return {
      text: 'High (Low risk)',
      emoji: '🟢',
      color: 0x55ff55
    };
  }

  return {
    text: 'Medium (Moderate risk)',
    emoji: '🟡',
    color: 0xffd966
  };
}

module.exports = {
  name: 'userinfo',
  description: 'Show moderation info about a user',

  // Restrito a staff (config.staffRoles)
  allowedRoles: config.staffRoles || [],

  /**
   * Uso:
   * - !userinfo
   *   → mostra info do próprio autor
   * - !userinfo @user
   *   → mostra info do utilizador mencionado
   */
  async execute(message, args, client) {
    try {
      if (!message.guild) return;

      const guild = message.guild;

      // --------------------------------------------------------
      // Escolher alvo:
      // - se houver mention → esse member
      // - senão → o próprio autor
      // --------------------------------------------------------
      const targetMember =
        message.mentions.members.first() ||
        message.member;

      if (!targetMember) {
        return message
          .reply('❌ Could not resolve the target member.')
          .catch(() => null);
      }

      const user = targetMember.user;

      // --------------------------------------------------------
      // Buscar dados de moderação (warnings + trust) via service
      // --------------------------------------------------------
      const dbUser = await warningsService.getOrCreateUser(
        guild.id,
        user.id
      );

      const trustCfg = getTrustConfig();
      const trustValue = Number.isFinite(dbUser.trust)
        ? dbUser.trust
        : trustCfg.base;

      const trustMeta = getTrustLabel(trustValue, trustCfg);

      // Warning count
      const warningsCount = dbUser.warnings || 0;

      // Última infração / atualização de trust (se existirem no schema)
      const lastInfractionAt = dbUser.lastInfractionAt || null;
      const lastTrustUpdateAt = dbUser.lastTrustUpdateAt || null;

      const lastInfractionText = lastInfractionAt
        ? new Date(lastInfractionAt).toLocaleString()
        : 'No infractions registered (or data not available)';

      const lastTrustUpdateText = lastTrustUpdateAt
        ? new Date(lastTrustUpdateAt).toLocaleString()
        : 'N/A';

      // --------------------------------------------------------
      // Info de Discord (conta / guild)
// --------------------------------------------------------
      const createdAt = user.createdAt
        ? user.createdAt.toLocaleString()
        : 'Unknown';

      const joinedAt = targetMember.joinedAt
        ? targetMember.joinedAt.toLocaleString()
        : 'Unknown';

      const isMuted = targetMember.isCommunicationDisabled
        ? targetMember.isCommunicationDisabled()
        : false;

      // Roles (lista simples, max 10 para não ficar gigante)
      const roles = targetMember.roles.cache
        .filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => `<@&${r.id}>`);

      const rolesDisplay = roles.length
        ? roles.slice(0, 10).join(', ') + (roles.length > 10 ? ' …' : '')
        : 'No roles';

      // --------------------------------------------------------
      // Construir embed
      // --------------------------------------------------------
      const embed = new EmbedBuilder()
        .setTitle(`User Info - ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ size: 128 }))
        .setColor(trustMeta.color)
        .addFields(
          {
            name: '👤 Discord',
            value:
              `**User:** ${user.tag}\n` +
              `**ID:** \`${user.id}\`\n` +
              `**Account created:** ${createdAt}\n` +
              `**Joined this server:** ${joinedAt}`,
            inline: false
          },
          {
            name: '🛡 Moderation',
            value:
              `**Warnings:** ${warningsCount}\n` +
              `**Currently muted:** ${isMuted ? 'Yes' : 'No'}\n` +
              `**Last infraction:** ${lastInfractionText}`,
            inline: false
          },
          {
            name: '🔐 Trust Score',
            value: trustCfg.enabled
              ? `${trustMeta.emoji} **${trustValue}/${trustCfg.max}** — ${trustMeta.text}\n` +
                `Last trust update: ${lastTrustUpdateText}`
              : 'Trust system is currently **disabled** in config.',
            inline: false
          },
          {
            name: '🧩 Roles',
            value: rolesDisplay,
            inline: false
          }
        )
        .setTimestamp(new Date());

      await message.channel.send({ embeds: [embed] }).catch(() => null);

      // --------------------------------------------------------
      // Logar utilização do comando (opcional mas útil)
      // --------------------------------------------------------
      await logger(
        client,
        'User Info',
        user,                // user “analisado”
        message.author,      // executor do comando
        `User info requested.\nWarnings: **${warningsCount}**\nTrust: **${trustValue}/${trustCfg.max}**`,
        guild
      );

    } catch (err) {
      console.error('[userinfo] Error:', err);
      await message
        .reply('❌ Failed to fetch user info.')
        .catch(() => null);
    }
  }
};
