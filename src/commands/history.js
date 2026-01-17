// src/commands/history.js

const { PermissionsBitField } = require('discord.js');

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

  const byMention = message.mentions.members.first();
  if (byMention) return byMention;

  const raw = (args?.[0] || '').trim();
  if (raw) {
    const id = raw.replace(/[<@!>]/g, ''); // suporta <@id>, <@!id> e id direto
    if (/^\d{15,25}$/.test(id)) {
      const byId = await guild.members.fetch(id).catch(() => null);
      if (byId) return byId;
    }
  }

  return null;
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

      // Segurança extra: só staff
      if (!isStaff(message.member)) {
        return message
          .reply("❌ You don't have permission to use this command.")
          .catch(() => null);
      }

      const member = (await resolveTarget(message, args)) || message.member;
      if (!member) {
        return message
          .reply('❌ Usage: !history @user or !history <userId> [limit]')
          .catch(() => null);
      }

      const user = member.user;

      const limitArg = Number(args?.[1]) || 10;
      const limit = Math.min(Math.max(limitArg, 1), 50);

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

      const lines = infractions.map((inf, idx) => {
        const index = infractions.length - idx + 0; // só para ficar bonitinho
        const type = String(inf.type || 'UNKNOWN').toUpperCase();
        const when = formatRelativeTime(inf.createdAt);

        const duration =
          inf.duration != null &&
          Number.isFinite(Number(inf.duration)) &&
          Number(inf.duration) > 0
            ? ` • ${Math.round(Number(inf.duration) / 60000)}m`
            : '';

        const reason = truncate(inf.reason || 'No reason provided', 120);

        return `#${index} — **${type}**${duration} — ${when}\n   └ ${reason}`;
      });

      const typeSummary = Object.keys(counts)
        .map((t) => `• **${t.toUpperCase()}**: ${counts[t]}`)
        .join('\n');

      const header =
        `🧾 Infraction history for **${user.tag}** (\`${user.id}\`) in **${guild.name}**\n` +
        `Total stored: **${totalStored}** infractions\n` +
        (typeSummary ? `${typeSummary}\n\n` : '');

      // evitar ultrapassar limite de 2000 chars do Discord
      const chunks = [];
      let current = header;

      for (const line of lines) {
        if ((current + '\n' + line).length > 1900) {
          chunks.push(current);
          current = line;
        } else {
          current += '\n' + line;
        }
      }
      if (current) chunks.push(current);

      for (const chunk of chunks) {
        // eslint-disable-next-line no-await-in-loop
        await message.channel.send(chunk).catch(() => null);
      }
    } catch (err) {
      console.error('[history] Error:', err);
      await message
        .reply('❌ An unexpected error occurred while fetching history.')
        .catch(() => null);
    }
  }
};
