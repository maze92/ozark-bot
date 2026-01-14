const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const User = require('../database/models/User');
const config = require('../config/defaultConfig');
const logger = require('./logger');

/**
 * Sistema de AutoModeração
 * - Remove mensagens proibidas
 * - Aplica warns automáticos
 * - Muta ao atingir o limite
 */
module.exports = async function autoModeration(message, client) {
  try {
    // ------------------------------
    // Validações básicas
    // ------------------------------
    if (!message) return;
    if (!message.guild) return;
    if (!message.content) return;
    if (message.author.bot) return;

    // Evitar processar a mesma mensagem mais de uma vez
    if (message._autoModHandled) return;
    message._autoModHandled = true;

    const botMember = message.guild.members.me;
    if (!botMember) return;

    // ------------------------------
    // Admin / Hierarquia bypass
    // ------------------------------
    if (
      message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      console.log('[AutoMod] Administrator bypass:', message.author.tag);
      return;
    }

    if (
      message.member.roles.highest.position >=
      botMember.roles.highest.position
    ) {
      console.warn(
        `[AutoMod] Cannot moderate ${message.author.tag} (higher role)`
      );
      return;
    }

    // ------------------------------
    // Permissões do bot
    // ------------------------------
    const permissions = message.channel.permissionsFor(botMember);
    if (!permissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      console.error('[AutoMod] Missing Manage Messages permission');
      return;
    }

    // ------------------------------
    // Configurações
    // ------------------------------
    const bannedWords = [
      ...(config.bannedWords?.pt || []),
      ...(config.bannedWords?.en || [])
    ];

    const maxWarnings = config.maxWarnings || 3;
    const muteDuration = config.muteDuration || 10 * 60 * 1000;

    // ------------------------------
    // Limpeza da mensagem
    // ------------------------------
    const cleanContent = message.content
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, '')
      .replace(/[^\w\s]/g, '')
      .toLowerCase();

    const foundWord = bannedWords.find(word =>
      cleanContent.includes(word.toLowerCase())
    );

    if (!foundWord) return;

    // ------------------------------
    // Apagar mensagem
    // ------------------------------
    await message.delete().catch(err => {
      console.error('[AutoMod] Failed to delete message:', err.message);
    });

    // ------------------------------
    // Base de dados
    // ------------------------------
    let user = await User.findOne({
      userId: message.author.id,
      guildId: message.guild.id
    });

    if (!user) {
      user = await User.create({
        userId: message.author.id,
        guildId: message.guild.id,
        warnings: 0,
        trust: 30
      });
    }

    user.warnings += 1;
    await user.save();

    // ------------------------------
    // Aviso no canal
    // ------------------------------
    await message.channel.send({
      content: `⚠️ ${message.author}, inappropriate language is not allowed.\n**Warning:** ${user.warnings}/${maxWarnings}`
    }).catch(() => null);

    // ------------------------------
    // Log
    // ------------------------------
    await logger(
      client,
      'Automatic Warn',
      message.author,
      client.user,
      `Word: **${foundWord}**\nWarnings: ${user.warnings}/${maxWarnings}`,
      message.guild
    );

    // ------------------------------
    // Timeout automático
    // ------------------------------
    if (user.warnings >= maxWarnings) {
      if (!message.member.moderatable) {
        console.warn('[AutoMod] Member not moderatable:', message.author.tag);
        return;
      }

      await message.member.timeout(
        muteDuration,
        'Exceeded automatic warning limit'
      );

      await message.channel.send(
        `🔇 ${message.author} has been muted for ${muteDuration / 60000} minutes due to repeated infractions.`
      ).catch(() => null);

      await logger(
        client,
        'Automatic Mute',
        message.author,
        client.user,
        `Duration: ${muteDuration / 60000} minutes`,
        message.guild
      );

      // Reset warnings após mute
      user.warnings = 0;
      await user.save();
    }

  } catch (err) {
    console.error('[AutoMod] Critical error:', err);
  }
};
