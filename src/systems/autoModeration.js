// src/systems/autoModeration.js
// ============================================================
// AutoMod:
// - deteta banned words
// - apaga a mensagem (se tiver perm)
// - adiciona warning (warningsService)
// - cria infração WARN (infractionsService)
// - aplica timeout se atingir maxWarnings (e cria infração MUTE)
// - log centralizado
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
    if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      console.log('[AutoMod] Administrator bypass:', message.author.tag);
      return;
    }

    // hierarquia: não dá para moderar quem tem role >= bot
    if (message.member.roles.highest.position >= botMember.roles.highest.position) {
      console.warn(`[AutoMod] Cannot moderate ${message.author.tag} (higher role)`);
      return;
    }

    // config
    const bannedWords = [
      ...(config.bannedWords?.pt || []),
      ...(config.bannedWords?.en || [])
    ];

    const maxWarnings = config.maxWarnings ?? 3;
    const muteDuration = config.muteDuration ?? (10 * 60 * 1000);

    // limpar msg (remove links, emojis custom, pontuação)
    const cleanContent = message.content
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, '')
      .replace(/[^\w\s]/g, '')
      .toLowerCase();

    // detetar palavra proibida com regex simples (leet)
    const foundWord = bannedWords.find(word => {
      const pattern = String(word)
        .replace(/a/gi, '[a4@]')
        .replace(/e/gi, '[e3]')
        .replace(/i/gi, '[i1!]')
        .replace(/o/gi, '[o0]')
        .replace(/u/gi, '[uü]')
        .replace(/s/gi, '[s5$]');
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      return regex.test(cleanContent);
    });

    if (!foundWord) return;

    // tentar apagar mensagem (precisa ManageMessages)
    const perms = message.channel.permissionsFor(botMember);
    const canDelete = perms?.has(PermissionsBitField.Flags.ManageMessages);

    if (canDelete) {
      await message.delete().catch(() => null);
    } else {
      console.warn('[AutoMod] Missing ManageMessages: cannot delete message');
    }

    // add warning via service
    const dbUser = await warningsService.addWarning(guild.id, message.author.id, 1);

    // criar infração WARN
    await infractionsService.create({
      guild,
      user: message.author,
      moderator: client.user,
      type: 'WARN',
      reason: `AutoMod detected banned word: ${foundWord}`,
      duration: null
    }).catch(() => null);

    // avisar canal
    await message.channel.send({
      content: `⚠️ ${message.author}, inappropriate language is not allowed.\n**Warning:** ${dbUser.warnings}/${maxWarnings}`
    }).catch(() => null);

    // log
    await logger(
      client,
      'Automatic Warn',
      message.author,
      client.user,
      `Word: **${foundWord}**\nWarnings: **${dbUser.warnings}/${maxWarnings}**\nDeleted: **${canDelete ? 'yes' : 'no (missing ManageMessages)'}**`,
      guild
    );

    // timeout se atingir limite
    if (dbUser.warnings >= maxWarnings) {
      // precisa ModerateMembers
      const canTimeout = perms?.has(PermissionsBitField.Flags.ModerateMembers);

      if (!canTimeout || !message.member.moderatable) {
        console.warn('[AutoMod] Cannot timeout (missing permission or not moderatable)');
        return;
      }

      await message.member.timeout(muteDuration, 'Exceeded automatic warning limit');

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

      // reset warnings após mute
      await warningsService.resetWarnings(guild.id, message.author.id).catch(() => null);
    }

  } catch (err) {
    console.error('[AutoMod] Critical error:', err);
  }
};
