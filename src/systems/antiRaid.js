const User = require('../database/models/User');
const logger = require('./logger');

const joinMap = new Map();

module.exports = async (member, client) => {
  if (!member.guild) return;

  const now = Date.now();
  const guildId = member.guild.id;

  // Registrar timestamps de joins recentes
  const joins = joinMap.get(guildId) || [];
  joins.push(now);
  joinMap.set(guildId, joins.filter(t => now - t < 60000)); // últimos 60 segundos

  // Se houver 5 ou mais joins em 1 minuto
  if (joins.length >= 5) {
    try {
      const user = await User.findOne({
        userId: member.id,
        guildId
      });

      if (!user) return;

      // Timeout se trust baixo
      if (user.trust < 40 && member.moderatable) {
        await member.timeout(60 * 60 * 1000, 'Anti-Raid');

        // Log centralizado
        await logger(
          client,
          'Anti-Raid',
          member.user,      // usuário afetado
          member.user,      // executor (não há moderador)
          `Timed out due to low trust (${user.trust})`,
          member.guild
        );
      }
    } catch (err) {
      console.error(`[Anti-Raid] Error handling ${member.user.tag}:`, err);
    }
  }
};
