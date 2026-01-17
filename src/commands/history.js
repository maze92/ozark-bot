// src/commands/history.js

const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const config = require('../config/defaultConfig');
const infractionsService = require('../systems/infractionsService');

function isStaff(member) {
  if (!member) return false;

  const isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator);
  if (isAdmin) return true;

  const staffRoles = Array.isArray(config.staffRoles) ? config.staffRoles : [];
  if (!staffRoles.length) return false;

  return member.roles?.cache?.some((r) => staffRoles.includes(r.id));
}

async function resolveTarget(message, args) {
  const guild = message.guild;
  if (!guild) return null;

  const byMention = message.mentions.members.first();
  if (byMention) return byMention;

  const raw = (args?.[0] || '').trim();
  if (!raw) return null;

  const id = raw.replace(/[<@!>]/g, '');
  if (!/^\d{15,25}$/.test(id)) return null;

  const byId = await guild.members.fetch(id).catch(() => null);
  return byId || null;
}

function formatRelativeTime(date) {
  if (!date) return 'Unknown';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return `<t:${Math.floor(d.getTime() / 1000)}:R>`;
}

function truncate(str, max = 90) {
  const s = String(str || '').trim();
  if (!s) return 'No reason provided';
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}

module.exports = {
  name: 'history',
  description: 'Show recent infractions of a user',

  async execute(message, args, client) {
    try {
      if (!message?.guild) return;

      const guild = message.guild;

      // Só staff
      if (!isStaff(message.member)) {
        return message
          .reply("❌ You don't have permission to use this command.")
          .catch(() => null);
      }

      // Alvo: @user, ID ou o próprio autor se nada for passado
      const member =
        (await resolveTarget(message, args)) ||
        message.member;
      if (!member) {
        return message
          .reply('❌ Usage: !history @user or !history <userId> [limit]')
          .catch(() => null);
      }

      const user = member.user;

      const limitArg = Number(args?.[1]) || 10;
      const limit = Math.min(Math.max(limitArg, 1), 20); // 20 para não ficar gigante

      const infractions = await infractionsService.getRecentInfractions(
        guild.id,
        user.id,
        limit
      );
      const counts = await infractionsService.countInfractionsByType(guild.id, user.id);

      if (!infractions.length) {
        return message
          .reply(`✅ No infractions found for **${user.tag}** (\`${user.id}\`).`)
          .catch(() => null);
      }

      const totalStored = Object.values(counts).reduce((a, b) => a + b, 0);

      // Resumo por tipo
      const typeSummary = Object.keys(counts)
        .map((t) => `**${t.toUpperCase()}**: ${counts[t]}`)
        .join(' • ');

      // Montar linhas para descrição do embed (limite ~4000 chars)
      const lines = infractions.map((inf, idx) => {
        const index = infractions.length - idx;
        const type = String(inf.type || 'UNKNOWN').toUpperCase();
        const when = formatRelativeTime(inf.createdAt);

        const durationMs = Number(inf.duration);
        const duration =
          Number.isFinite(durationMs) && durationMs > 0
            ? ` • ${Math.round(durationMs / 60000)}m`
            : '';

        const reason = truncate(inf.reason || 'No reason provided', 120);

        return `**#${index} — ${type}**${duration} — ${when}\n> ${reason}`;
      });

      // Garantir que não passa dos 4000 chars
      let desc = '';
      for (const line of lines) {
        if ((desc + '\n' + line).length > 3800) break;
        desc += (desc ? '\n' : '') + line;
      }

      const embed = new EmbedBuilder()
        .setColor(0xffcc00)
        .setAuthor({ name: `${user.tag}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setTitle(`Infraction history in ${guild.name}`)
        .setDescription(desc || 'No details.')
        .setFooter({
          text: `Total infractions stored: ${totalStored}`
        })
        .setTimestamp(new Date());

      if (typeSummary) {
        embed.addFields({
          name: 'Summary by type',
          value: typeSummary
        });
      }

      return message.channel.send({ embeds: [embed] }).catch(() => null);
    } catch (err) {
      console.error('[history] Error:', err);
      return message
        .reply('❌ An unexpected error occurred while fetching history.')
        .catch(() => null);
    }
  }
};
