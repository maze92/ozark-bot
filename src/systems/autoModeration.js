// src/systems/autoModeration.js
// ============================================================
// AutoMod:
// - deteta banned words
// - apaga mensagem (se ManageMessages)
// - adiciona warning (warningsService)
// - cria infração WARN
// - timeout se atingir maxWarnings + infração MUTE
// ============================================================

const { PermissionsBitField } = require('discord.js');
const config = require('../config/defaultConfig');

const logger = require('./logger');
const warningsService = require('./warningsService');
const infractionsService = require('./infractionsService');

module.exports = async function autoModeration(message, client) {
  try {
    if (!message?.guild) return;
    if (!message?.content) return;
    if (message.author?.bot) return;
    if (!message.member) return;

    // anti-dupe
    if (message._autoModHandled) return;
    message._autoModHandled = true;

    const guild = message.guild;
    const botMember = guild.members.me;
    if (!botMember) return;

    // bypass admin
    if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    // hierarquia: user >= bot
    if (message.member.roles.highest.position >= botMember.roles.highest.position) return;

    const bannedWords = [
      ...(config.bannedWords?.pt || []),
      ...(config.bannedWords?.en || [])
    ];

    const maxWarnings = config.maxWarnings ?? 3;
    const muteDuration = config.muteDuration ?? (10 * 60 * 1000);

    // limpar mensagem
    const cleanContent = message.content
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, '')
      .replace(/[^\w\s]/g, '')
      .toLowerCase();

    // detetar banned com regex/leet
    const foundWord = bannedWords.find(word => {
      const pattern = String(word)
        .replace(/a/gi, '[a4@]')
        .replace(/e/gi, '[e3]')
        .replace(/i/gi, '[i1!]')
        .replace(/o/gi, '[o0]')
        .replace(/u/gi, '[uü]')
        .replace(/s/gi, '[s5$]');
      return new RegExp(`\\b${pattern}\\b`, 'i').test(cleanContent);
    });

    if (!foundWord) return;

    const perms = message.channel.permissionsFor(botMember);
    const canDelete = perms?.has(PermissionsBitField.Flags.ManageMessages);
    const canTimeout = perms?.has(PermissionsBitField.Flags.ModerateMembers);

    // apagar msg se possível
    if (canDelete) {
      await message.delete().catch(() => null);
    }

    // +1 warning
    const dbUser = await warningsService.addWarning(guild.id, message.author.id, 1);

    // infração WARN
    await infractionsService.create({
      guild,
      user: message.author,
      moderator: client.user,
      type: 'WARN',
      reason: `AutoMod detected banned word: ${foundWord}`,
      duration: null
    }).catch(() => null);

    // aviso no canal
    await message.channel.send({
      content: `⚠️ ${message.author}, inappropriate language is not allowed.\n**Warning:** ${dbUser.warnings}/${maxWarnings}`
    }).catch(() => null);

    // log
    await logger(
      client,
      'Automatic Warn',
      message.author,
      client.user,
      `Word: **${foundWord}**\nWarnings: **${dbUser.warnings}/${maxWarnings}**\nDeleted: **${canDelete ? 'yes' : 'no'}**`,
      guild
    );

    // timeout se atingiu limite
    if (dbUser.warnings >= maxWarnings) {
      if (!canTimeout || !message.member.moderatable) return;

      await message.member.timeout(muteDuration, 'AutoMod: exceeded warning limit');

      await infractionsService.create({
        guild,
        user: message.author,
        moderator: client.user,
        type: 'MUTE',
        reason: 'AutoMod: exceeded warning limit',
        duration: muteDuration
      }).catch(() => null);

      await message.channel.send(
        `🔇 ${message.author} has been muted for **${Math.round(muteDuration / 60000)} minutes** due to repeated infractions.`
      ).catch(() => null);

      await logger(
        client,
        'Automatic Mute',
        message.author,
        client.user,
        `Duration: **${Math.round(muteDuration / 60000)} minutes**`,
        guild
      );

      // reset warnings
      await warningsService.resetWarnings(guild.id, message.author.id).catch(() => null);
    }

  } catch (err) {
    console.error('[AutoMod] Critical error:', err);
  }
};
