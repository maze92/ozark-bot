// src/commands/unmute.js

/**
 * Comando: !unmute
 * 
 * Faz:
 * - Remove o timeout (mute) de um utilizador
 * - Protegido por cargos de staff (allowedRoles)
 * - Regista a ação no sistema de logs (Discord log-bot + dashboard)
 */

const { PermissionsBitField } = require('discord.js');
const logger = require('../systems/logger');

module.exports = {
  name: 'unmute',
  description: 'Unmute a muted user',

  // IDs dos cargos autorizados (staff)
  allowedRoles: [
    '1385619241235120177',
    '1385619241235120174',
    '1385619241235120173'
  ],

  async execute(message, args, client) {
    try {
      // ------------------------------
      // Validações básicas
      // ------------------------------
      if (!message.guild) return;
      if (!message.member) return;

      const executor = message.member;              // Quem executou o comando
      const botMember = message.guild.members.me;   // O bot no servidor

      if (!botMember) {
        return message.reply('❌ Bot member not found.');
      }

      // ------------------------------
      // Permissão do BOT (no canal!)
      // - Timeout/unmute exige ModerateMembers
      // ------------------------------
      const perms = message.channel.permissionsFor(botMember);
      if (!perms?.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply('❌ I do not have permission to unmute members (Moderate Members).');
      }

      // ------------------------------
      // Permissão do executor
      // - allowedRoles OU Administrator
      // ------------------------------
      const hasAllowedRole = executor.roles.cache.some(role =>
        this.allowedRoles.includes(role.id)
      );

      const isAdmin = executor.permissions.has(PermissionsBitField.Flags.Administrator);

      if (!hasAllowedRole && !isAdmin) {
        return message.reply("❌ You don't have permission to use this command.");
      }

      // ------------------------------
      // Utilizador alvo
      // ------------------------------
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply('❌ Usage: !unmute @user');
      }

      // ------------------------------
      // Hierarquia do Discord
      // - Não podemos moderar cargos >= bot
      // ------------------------------
      if (target.roles.highest.position >= botMember.roles.highest.position) {
        return message.reply('❌ I cannot unmute this user (their role is higher/equal to my highest role).');
      }

      // (Opcional) também impedir moderar alguém acima/igual ao executor
      if (target.roles.highest.position >= executor.roles.highest.position && !isAdmin) {
        return message.reply('❌ You cannot unmute this user (their role is higher/equal to yours).');
      }

      // ------------------------------
      // Verifica se está muted (timeout ativo)
      // ------------------------------
      if (!target.isCommunicationDisabled()) {
        return message.reply(`⚠️ **${target.user.tag}** is not muted.`);
      }

      // ------------------------------
      // Remove timeout (unmute)
      // ------------------------------
      await target.timeout(null, `Unmuted by ${message.author.tag}`);

      await message.channel.send(`✅ **${target.user.tag}** has been unmuted.`).catch(() => null);

      // ------------------------------
      // Log da ação (Discord + dashboard)
      // ------------------------------
      await logger(
        client,
        'Manual Unmute',
        target.user,
        message.author,
        'User unmuted manually',
        message.guild
      );

    } catch (err) {
      console.error('[unmute] Error:', err);
      await message.reply('❌ Failed to unmute the user. Check my permissions and role hierarchy.').catch(() => null);
    }
  }
};
