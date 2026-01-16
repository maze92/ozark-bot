// src/commands/clear.js
// ============================================================
// Comando: !clear
// ------------------------------------------------------------
// O que faz:
// - Apaga em massa mensagens no canal atual (bulkDelete)
// - Regista log no canal de logs + Dashboard (via logger)
// ------------------------------------------------------------
// Regras importantes:
// - Staff-only (controlado em systems/commands.js → STAFF_ONLY)
// - O BOT precisa de permissão ManageMessages no canal
// - Limite Discord: até 100 mensagens, e não apaga msgs com +14 dias
//
// Uso:
// - !clear 10
// - !clear 50
// ============================================================

const { PermissionsBitField } = require('discord.js');
const config = require('../config/defaultConfig');
const logger = require('../systems/logger');

module.exports = {
  name: 'clear',
  description: 'Clear messages in the channel',

  /**
   * Execução do comando
   * @param {Message} message
   * @param {string[]} args
   * @param {Client} client
   *
   * Uso: !clear <1-100>
   */
  async execute(message, args, client) {
    try {
      // ------------------------------
      // Validações básicas
      // ------------------------------
      if (!message?.guild) return;
      if (!message.channel) return;

      const guild = message.guild;
      const botMember = guild.members.me;
      if (!botMember) return;

      // ------------------------------
      // Permissões do BOT
      // - Precisa de ManageMessages no canal
      // ------------------------------
      const perms = message.channel.permissionsFor(botMember);
      if (!perms?.has(PermissionsBitField.Flags.ManageMessages)) {
        return message
          .reply('❌ I do not have permission to manage messages in this channel.')
          .catch(() => null);
      }

      // ------------------------------
      // Parser do argumento (quantidade)
      // ------------------------------
      const raw = args[0];
      const amount = parseInt(raw, 10);

      // Limites: 1–100 (limite Discord para bulkDelete)
      if (!amount || Number.isNaN(amount) || amount < 1 || amount > 100) {
        const prefix = config.prefix || '!';
        return message
          .reply(`❌ Usage: \`${prefix}clear <1-100>\``)
          .catch(() => null);
      }

      // ------------------------------
      // bulkDelete
      // - segundo parâmetro "true": ignora mensagens com +14 dias
      // ------------------------------
      const deleted = await message.channel.bulkDelete(amount, true).catch((err) => {
        console.error('[clear] bulkDelete error:', err);
        return null;
      });

      if (!deleted) {
        return message
          .reply('⚠️ I could not delete messages. They may be too old or I lack permissions.')
          .catch(() => null);
      }

      // ------------------------------
      // Mensagem de feedback temporária
      // ------------------------------
      const feedback = await message.channel
        .send(`🧹 Cleared **${deleted.size}** messages.`)
        .catch(() => null);

      if (feedback) {
        setTimeout(() => {
          feedback.delete().catch(() => null);
        }, 5000).unref?.();
      }

      // ------------------------------
      // Log (Discord + Dashboard)
      // ------------------------------
      await logger(
        client,
        'Clear Messages',
        null, // user afetado não é 1 em específico
        message.author,
        `Cleared **${deleted.size}** messages in #${message.channel.name}`,
        guild
      );

    } catch (err) {
      console.error('[clear] Error:', err);
      message
        .reply('❌ An unexpected error occurred while clearing messages.')
        .catch(() => null);
    }
  }
};
