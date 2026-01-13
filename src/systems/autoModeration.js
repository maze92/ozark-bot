const User = require('../database/models/User');
const config = require('../config/defaultConfig');
const infractions = require('./infractions');

const bannedWords = [
  ...(config.bannedWords?.pt || []),
  ...(config.bannedWords?.en || [])
];

module.exports = async function autoModeration(message, client) {
  if (!message.guild || message.author.bot) return;

  // Evitar duplicações
  if (message._automodHandled) return;
  message._automodHandled = true;

  const cleanContent = message.content
    .toLowerCase()
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[^\w\s]/gi, '');

  const foundWord = bannedWords.find(word =>
    cleanContent.includes(word.toLowerCase())
  );

  if (!foundWord) return;

  // Apagar mensagem
  await message.delete().catch(() => null);

  // Obter/criar utilizador
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

  // Criar infração WARN
  await infractions.create({
    client,
    guild: message.guild,
    user: message.author,
    moderator: message.author,
    type: 'WARN',
    reason: `Inappropriate language: ${foundWord}`
  });

  await message.channel.send(
    `⚠️ ${message.author}, inappropriate language is not allowed.\nWarnings: ${user.warnings}/${config.maxWarnings}`
  );

  // MUTE automático
  if (user.warnings >= config.maxWarnings) {
    if (message.member?.moderatable) {
      await message.member.timeout(
        config.muteDuration,
        'Exceeded automatic warning limit'
      );

      await infractions.create({
        client,
        guild: message.guild,
        user: message.author,
        moderator: client.user,
        type: 'MUTE',
        reason: 'Exceeded warning limit',
        duration: config.muteDuration
      });

      user.warnings = 0;
      await user.save();

      await message.channel.send(
        `🔇 ${message.author} has been muted for ${config.muteDuration / 60000} minutes.`
      );
    }
  }
};
