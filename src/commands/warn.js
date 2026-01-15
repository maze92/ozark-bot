// src/commands/warn.js

/**
 * Comando: !warn
 * - Dá um aviso manual a um utilizador
 * - Respeita hierarquia de cargos (executor e bot)
 * - Guarda contador de warnings no MongoDB (User)
 * - Regista a ação no canal log-bot + dashboard (via logger centralizado)
 *
 * Uso:
 * - !warn @user
 * - !warn @user reason...
 */

const { PermissionsBitField } = require('discord.js');
const logger = require('../systems/logger');
const User = require('../database/models/User');
const config = require('../config/defaultConfig');

module.exports = {
  name: 'warn',
  description: 'Issue a manual warning to a user',

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

      const executorMember = message.member;
      const botMember = message.guild.members.me;

      if (!executorMember || !botMember) {
        return message.reply('❌ Could not resolve members (executor/bot).');
      }

      const prefix = config.prefix || '!';

      // ------------------------------
      // Permissões do BOT
      // - Para warn não precisamos de ManageMessages.
      // - O bot só precisa conseguir enviar mensagens e fazer logs.
      // ------------------------------
      const botPerms = message.channel.permissionsFor(botMember);
      if (!botPerms?.has(PermissionsBitField.Flags.SendMessages)) {
        return; // nem dá para responder
      }

      // ------------------------------
      // Permissão do executor (roles/admin)
      // - redundante se já verificas no messageCreate, mas seguro
      // ------------------------------
      const hasAllowedRole = executorMember.roles.cache.some(role =>
        this.allowedRoles.includes(role.id)
      );

      if (
        !hasAllowedRole &&
        !executorMember.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        return message.reply('❌ You do not have permission to use this command.');
      }

      // ------------------------------
      // Utilizador alvo
      // ------------------------------
      const targetMember = message.mentions.members.first();
      if (!targetMember) {
        return message.reply(`❌ Usage: ${prefix}warn @user [reason...]`);
      }

      // ------------------------------
      // Proteções anti-abuso
      // ------------------------------
      if (targetMember.id === message.author.id) {
        return message.reply('❌ You cannot warn yourself.');
      }

      if (targetMember.id === client.user.id) {
        return message.reply('❌ You cannot warn the bot.');
      }

      if (targetMember.user.bot) {
        return message.reply('⚠️ You cannot warn a bot.');
      }

      // ------------------------------
      // Hierarquia (Discord)
      // - Executor não pode warnar alguém com cargo >= ao dele
      // - Bot não pode atuar em alguém com cargo >= ao dele (para consistência)
      // ------------------------------
      if (targetMember.roles.highest.position >= executorMember.roles.highest.position) {
        return message.reply('❌ You cannot warn a user with an equal or higher role than yours.');
      }

      if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
        return message.reply('❌ I cannot warn this user due to role hierarchy (my role is too low).');
      }

      // Opcional: bloquear warning a Administrators (evita confusões)
      if (targetMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('❌ You cannot warn an Administrator.');
      }

      // ------------------------------
      // Motivo (opcional)
      // - Remover o mention dos args, tal como no mute
      // ------------------------------
      const cleanedArgs = args.filter(a => {
        const isMention = a.includes(`<@${targetMember.id}>`) || a.includes(`<@!${targetMember.id}>`);
        const isRawId = a === targetMember.id;
        return !isMention && !isRawId;
      });

      const reason = cleanedArgs.join(' ').trim() || 'No reason provided';

      // ------------------------------
      // Base de dados (User)
      // - Cria se não existir
      // - Incrementa warnings
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
        `⚠️ **${targetMember.user.tag}** has been warned.\n📊 **Total warnings:** ${dbUser.warnings}\n📝 **Reason:** ${reason}`
      ).catch(() => null);

      // ------------------------------
      // Log (Discord + Dashboard via logger centralizado)
      // ------------------------------
      await logger(
        client,
        'Manual Warn',
        targetMember.user,
        message.author,
        `Total warnings: **${dbUser.warnings}**\nReason: **${reason}**`,
        message.guild
      );

    } catch (err) {
      console.error('[warn] Error:', err);
      message.reply('❌ An unexpected error occurred.').catch(() => null);
    }
  }
};
