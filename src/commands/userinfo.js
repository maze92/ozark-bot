// src/commands/userinfo.js
// ============================================================
// Comando: !userinfo
// ------------------------------------------------------------
// Mostra informação sobre um utilizador na guild, incluindo:
// - Tag + ID
// - Datas (criação da conta / entrada no servidor)
// - Nº de warnings (User model)
// - Contagem total de infrações (se o modelo Infraction existir)
// - Trust Score + nível de risco (Trust visível só para staff)
//
// Uso:
//  - !userinfo              → mostra info do autor
//  - !userinfo @user        → mostra info do mencionado
//  - !userinfo 1234567890   → tenta buscar por ID
// ============================================================

const { EmbedBuilder, PermissionsBitField } = require('discord.js');

const config = require('../config/defaultConfig');
const warningsService = require('../systems/warningsService');

let Infraction = null;
// Tenta carregar o modelo Infraction, mas não crasha se não existir
try {
  Infraction = require('../database/models/Infraction');
} catch (e) {
  console.warn('[userinfo] Infraction model not found. Infraction stats disabled.');
}

// ------------------------------------------------------------
// Helpers de Trust (mesma lógica base que no AutoMod / warningsService)
// ------------------------------------------------------------
function getTrustConfig() {
  const cfg = config.trust || {};

  return {
    enabled: cfg.enabled !== false,
    base: cfg.base ?? 30,
    min: cfg.min ?? 0,
    max: cfg.max ?? 100,
    lowThreshold: cfg.lowThreshold ?? 10,
    highThreshold: cfg.highThreshold ?? 60
  };
}

/**
 * Converte o valor de trust num “nível de risco” legível.
 */
function getTrustLabel(trust, trustCfg) {
  if (!trustCfg.enabled) return 'N/A';

  const t = Number.isFinite(trust) ? trust : trustCfg.base;

  if (t <= trustCfg.lowThreshold) return 'High risk';
  if (t >= trustCfg.highThreshold) return 'Low risk';
  return 'Medium risk';
}

/**
 * Verifica se o membro é staff:
 * - Administrator OU
 * - tem algum role em config.staffRoles
 */
function isStaff(member) {
  if (!member) return false;

  if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  }

  const staffRoles = Array.isArray(config.staffRoles) ? config.staffRoles : [];
  if (!staffRoles.length) return false;

  return member.roles?.cache?.some((r) => staffRoles.includes(r.id));
}

/**
 * Resolve o alvo do comando:
 * - 1) @menção
 * - 2) ID via args[0]
 * - 3) fallback: o próprio autor
 */
async function resolveTarget(message, args) {
  const guild = message.guild;

  // 1) menção
  const mentioned = message.mentions.members.first();
  if (mentioned) return mentioned;

  // 2) ID
  const raw = args[0];
  if (raw) {
    try {
      const byId = await guild.members.fetch(raw).catch(() => null);
      if (byId) return byId;
    } catch {
      // ignorar erro
    }
  }

  // 3) fallback → o autor
  return message.member;
}

module.exports = {
  name: 'userinfo',
  description:
    'Shows information about a user, including warnings and trust score (trust is visible to staff only)',

  /**
   * Execução do comando
   * @param {Message} message
   * @param {string[]} args
   * @param {Client} client
   */
  async execute(message, args, client) {
    try {
      if (!message.guild) return;

      const guild = message.guild;
      const trustCfg = getTrustConfig();
      const requesterIsStaff = isStaff(message.member);

      // --------------------------------------------------------
      // Resolver o membro alvo
      // --------------------------------------------------------
      const member = await resolveTarget(message, args);
      if (!member) {
        return message
          .reply('❌ I could not resolve that user.')
          .catch(() => null);
      }

      const user = member.user;

      // --------------------------------------------------------
      // Carregar User doc (warnings + trust)
      // --------------------------------------------------------
      const dbUser = await warningsService.getOrCreateUser(guild.id, user.id);

      const warnings = dbUser.warnings ?? 0;
      const trustValue = Number.isFinite(dbUser.trust)
        ? dbUser.trust
        : trustCfg.base;
      const trustLabel = getTrustLabel(trustValue, trustCfg);

      // --------------------------------------------------------
      // Estatísticas de infrações (se o modelo existir)
      // --------------------------------------------------------
      let infractionsCount = 0;
      if (Infraction) {
        try {
          infractionsCount = await Infraction.countDocuments({
            guildId: guild.id,
            userId: user.id
          });
        } catch (e) {
          console.error('[userinfo] Failed counting infractions:', e);
        }
      }

      // --------------------------------------------------------
      // Datas formatadas (Discord timestamps)
      // --------------------------------------------------------
      const createdAt = user.createdAt
        ? `<t:${Math.floor(user.createdAt.getTime() / 1000)}:F>`
        : 'Unknown';

      const joinedAt = member.joinedAt
        ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`
        : 'Unknown';

      // --------------------------------------------------------
      // Campo de Trust Score:
      // - Staff → vê valor + nível de risco
      // - Utilizador normal → texto genérico (sem expor o número)
// --------------------------------------------------------
      let trustFieldValue = 'Trust system is currently **disabled**.';
      if (trustCfg.enabled) {
        if (requesterIsStaff) {
          trustFieldValue =
            `Trust: **${trustValue}/${trustCfg.max}**\n` +
            `Risk level: **${trustLabel}**`;
        } else {
          trustFieldValue =
            'Trust Score is **internal** and only visible to staff.\n' +
            'Moderation decisions may be stricter for repeat offenders.';
        }
      }

      // --------------------------------------------------------
      // Construir o embed
      // --------------------------------------------------------
      const embed = new EmbedBuilder()
        .setTitle(`User Info - ${user.tag}`)
        .setColor('Blue')
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: '👤 User',
            value: `Tag: **${user.tag}**\nID: \`${user.id}\``,
            inline: false
          },
          {
            name: '📅 Account',
            value:
              `Created at: ${createdAt}\n` +
              `Joined this server: ${joinedAt}`,
            inline: false
          },
          {
            name: '⚠️ Warnings & Infractions',
            value:
              `Warnings (User doc): **${warnings}** / **${config.maxWarnings ?? 3}**\n` +
              (Infraction
                ? `Infractions registered: **${infractionsCount}**`
                : 'Infractions: *model not configured*'),
            inline: false
          },
          {
            name: '🔐 Trust Score',
            value: trustFieldValue,
            inline: false
          }
        )
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp(new Date());

      await message.channel
        .send({ embeds: [embed] })
        .catch(() => null);
    } catch (err) {
      console.error('[userinfo] Error:', err);
      await message
        .reply(
          '❌ An unexpected error occurred while fetching user info.'
        )
        .catch(() => null);
    }
  }
};
