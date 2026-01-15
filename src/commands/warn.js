/**
 * Comando: !warn
 * - Dá um aviso manual a um utilizador
 * - Respeita hierarquia de cargos
 * - Protegido contra abuso
 * - Regista no Discord + Dashboard
 */

const { PermissionsBitField } = require('discord.js');
const logger = require('../systems/logger');
const User = require('../database/models/User');

module.exports = {
  name: 'warn',
  description: 'Issue a warning to a user',

  // IDs dos cargos autorizados (staff)
  allowedRoles: [
    '1385619241235120177',
    '1385619241235120174',
    '1385619241235120173'
  ],

  /**
   * Execução do comando
   */
  async execute(message, args, client) {
    try {
      // ------------------------------
      // Validações básicas
      // ------------------------------
      if (!message.guild) return;

      const executor = message.member;
      const botMember = message.guild.members.me;

      if (!botMember) return;

      // ------------------------------
      // Permissão do bot
      // ------------------------------
      if (
        !botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)
      ) {
        return message.reply('❌ I do not have permission to manage messages.');
      }

      // ------------------------------
      // Permissão do executor
      // ------------------------------
      const hasAllowedRole = executor.roles.cache.some(role =>
        this.allowedRoles.includes(role.id)
      );

      if (
        !hasAllowedRole &&
        !executor.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        return message.reply('❌ You do not have permission to use this command.');
      }

      // ------------------------------
      // Utilizador alvo
      // ------------------------------
      const targetMember = message.mentions.members.first();
      if (!targetMember) {
        return message.reply('❌ Please mention a user to warn.');
      }

      // ------------------------------
      // Proteções de hierarquia
      // ------------------------------
      if (targetMember.id === message.author.id) {
        return message.reply('❌ You cannot warn yourself.');
      }

      if (targetMember.id === client.user.id) {
        return message.reply('❌ You cannot warn the bot.');
      }

      if (
        targetMember.roles.highest.position >=
        executor.roles.highest.position
      ) {
        return message.reply(
          '❌ You cannot warn a user with an equal or higher role.'
        );
      }

      if (
        targetMember.roles.highest.position >=
        botMember.roles.highest.position
      ) {
        return message.reply(
          '❌ I cannot warn this user due to role hierarchy.'
        );
      }

      // ------------------------------
      // Base de dados
      // ------------------------------
      let dbUser = await User.findOne({
        userId: targetMember.id,
        guildId: message.guild.id
      });

      if (!dbUser) {
        dbUser = await User.create({
          userId: targetMember.id,
          guildId: message.guild.id,
          warnings: 0,
          trust: 30
        });
      }

      dbUser.warnings += 1;
      await dbUser.save();

      // ------------------------------
      // Mensagem no canal
      // ------------------------------
      await message.channel.send(
        `⚠️ ${targetMember} has been warned.\n**Total warnings:** ${dbUser.warnings}`
      );

      // ------------------------------
      // Log (Discord + Dashboard)
      // ------------------------------
      await logger(
        client,
        'Manual Warn',
        targetMember.user,
        message.author,
        `Total warnings: ${dbUser.warnings}`,
        message.guild
      );

    } catch (err) {
      console.error('[WARN COMMAND ERROR]', err);
      message.reply('❌ An unexpected error occurred.');
    }
  }
};
