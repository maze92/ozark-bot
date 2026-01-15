/**
 * Comando: !clear
 * - Apaga mensagens em massa num canal
 * - Protegido por cargos e permissões
 * - Regista ação no sistema de logs
 */

const { PermissionsBitField } = require('discord.js');
const logger = require('../systems/logger');

module.exports = {
  name: 'clear',
  description: 'Clear messages in the channel',

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
        !botMember.permissions.has(
          PermissionsBitField.Flags.ManageMessages
        )
      ) {
        return message.reply(
          '❌ I do not have permission to manage messages.'
        );
      }

      // ------------------------------
      // Permissão do executor
      // ------------------------------
      const hasAllowedRole = executor.roles.cache.some(role =>
        this.allowedRoles.includes(role.id)
      );

      if (
        !hasAllowedRole &&
        !executor.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {
        return message.reply(
          '❌ You do not have permission to use this command.'
        );
      }

      // ------------------------------
      // Quantidade de mensagens
      // ------------------------------
      const amount = parseInt(args[0]);

      if (!amount || amount < 1 || amount > 100) {
        return message.reply('❌ Usage: !clear <1-100>');
      }

      // ------------------------------
      // Apagar mensagens
      // ------------------------------
      const deletedMessages = await message.channel.bulkDelete(
        amount,
        true // ignora mensagens com +14 dias
      );

      // ------------------------------
      // Feedback no canal
      // ------------------------------
      const reply = await message.channel.send(
        `🧹 Cleared **${deletedMessages.size}** messages.`
      );

      // Apaga o feedback após 5 segundos
      setTimeout(() => {
        reply.delete().catch(() => null);
      }, 5000);

      // ------------------------------
      // Log (Discord + Dashboard)
      // ------------------------------
      await logger(
        client,
        'Clear Messages',
        null,
        message.author,
        `Cleared ${deletedMessages.size} messages in #${message.channel.name}`,
        message.guild
      );

    } catch (err) {
      console.error('[CLEAR COMMAND ERROR]', err);
      message.reply('❌ An unexpected error occurred.');
    }
  }
};
