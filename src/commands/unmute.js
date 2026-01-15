// src/commands/unmute.js

/**
 * Comando: !unmute
 *
 * Faz:
 * - Remove o timeout (mute) de um utilizador
 * - Protegido por cargos de staff (allowedRoles) ou Administrator
 * - Respeita hierarquia de cargos (bot e executor)
 * - Regista a ação no sistema de logs (Discord log-bot + dashboard)
 *
 * Uso:
 * - !unmute @user [reason...]
 */

const { PermissionsBitField } = require('discord.js');
const logger = require('../systems/logger');
const config = require('../config/defaultConfig');

module.exports = {
  name: 'unmute',
  description: 'Unmute a muted user (remove timeout)',

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
      if (!message?.guild) return;

      const executorMember = message.member;
      const botMember = message.guild.members.me;

      if (!executorMember || !botMember) {
        return message.reply('❌ Could not resolve members (executor/bot).');
      }

      const prefix = config.prefix || '!';

      // ------------------------------
      // Permissões do BOT no canal
      // - Unmute usa timeout(null) => exige ModerateMembers
      // ------------------------------
      const botPerms = message.channel.permissionsFor(botMember);
      if (!botPerms?.has(PermissionsBitField.Flags.ViewChannel)) return;

      if (!botPerms.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply('❌ I need **Moderate Members** permission to unmute (remove timeout).');
      }

      // ------------------------------
      // Permissões do executor
      // - allowedRoles OU Administrator
      // ------------------------------
      const hasAllowedRole = executorMember.roles.cache.some(role =>
        this.allowedRoles.includes(role.id)
      );

      const isAdmin = executorMember.permissions.has(
        PermissionsBitField.Flags.Administrator
      );

      if (!hasAllowedRole && !isAdmin) {
        return message.reply("❌ You don't have permission to use this command.");
      }

      // ------------------------------
      // Utilizador alvo
      // ------------------------------
      const targetMember = message.mentions.members.first();
      if (!targetMember) {
        return message.reply(`❌ Usage: ${prefix}unmute @user [reason...]`);
      }

      // Não permitir unmute em bots (opcional, mas recomendado)
      if (targetMember.user.bot) {
        return message.reply('⚠️ You cannot unmute a bot.');
      }

      // Evitar “unmute” a si próprio (não é erro grave, mas evita spam)
      if (targetMember.id === executorMember.id) {
        return message.reply('⚠️ You cannot unmute yourself.');
      }

      // ------------------------------
      // Hierarquia Discord
      // - Bot não pode moderar cargos >= bot
      // - Executor não deve moderar cargos >= executor (exceto admin)
      // ------------------------------
      if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
        return message.reply('❌ I cannot unmute this user (their role is higher/equal to my highest role).');
      }

      if (!isAdmin && targetMember.roles.highest.position >= executorMember.roles.highest.position) {
        return message.reply('❌ You cannot unmute this user (their role is higher/equal to yours).');
      }

      // ------------------------------
      // Verifica se o alvo está muted (timeout ativo)
      // ------------------------------
      if (!targetMember.isCommunicationDisabled()) {
        return message.reply(`⚠️ **${targetMember.user.tag}** is not muted.`);
      }

      // ------------------------------
      // Motivo (opcional)
      // - remove o mention do args e usa o resto como reason
      // ------------------------------
      const reason = args.slice(1).join(' ').trim() || 'No reason provided';

      // ------------------------------
      // Remove timeout (unmute)
      // ------------------------------
      await targetMember.timeout(null, `Unmuted by ${message.author.tag}: ${reason}`);

      await message.channel
        .send(`✅ **${targetMember.user.tag}** has been unmuted.\n📝 Reason: **${reason}**`)
        .catch(() => null);

      // ------------------------------
      // Log (Discord + dashboard)
      // ------------------------------
      await logger(
        client,
        'Manual Unmute',
        targetMember.user,
        message.author,
        `Channel: #${message.channel.name}\nReason: **${reason}**`,
        message.guild
      );
    } catch (err) {
      console.error('[unmute] Error:', err);
      await message
        .reply('❌ Failed to unmute the user. Check my permissions and role hierarchy.')
        .catch(() => null);
    }
  }
};
