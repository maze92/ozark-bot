const User = require('../database/models/User');
const logger = require('../systems/logger');

const userCache = new Map();  // Cache para os usuários

module.exports = async function autoModeration(message, client) {
  if (!message || !message.content || message.author.bot || !message.guild) return;

  if (message._automodHandled) return;  // Evita duplicação
  message._automodHandled = true;

  const cleanContent = message.content
    .replace(/https?:\/\/\S+/gi, '')  // Remove links
    .replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, '')  // Remove emojis
    .toLowerCase();

  const bannedWords = [...(config.bannedWords?.pt || []), ...(config.bannedWords?.en || [])];
  const foundWord = bannedWords.find(word => cleanContent.includes(word.toLowerCase()));
  
  if (!foundWord) return;  // Se não encontrou palavra proibida, retorna

  await message.delete().catch(() => null);  // Deleta a mensagem

  // Checa no cache se o usuário já foi encontrado
  let user = userCache.get(message.author.id);
  if (!user) {
    user = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
    if (!user) {
      user = await User.create({
        userId: message.author.id,
        guildId: message.guild.id,
        warnings: 0,
        trust: 30
      });
    }
    userCache.set(message.author.id, user);  // Cacheia o usuário
  }

  // Incrementa os warnings do usuário
  user.warnings += 1;
  await user.save();

  // Envia aviso
  await message.channel.send({
    content: `⚠️ ${message.author}, inappropriate language is not allowed.\n**Warning:** ${user.warnings}/${config.maxWarnings}`
  }).catch(() => null);

  // Log centralizado
  await logger(client, 'Automatic Warn', message.author, message.author, `Word: ${foundWord}\nWarnings: ${user.warnings}/${config.maxWarnings}`);

  // Se o usuário atingiu o limite de warnings, aplica o mute
  if (user.warnings >= config.maxWarnings) {
    if (message.member?.moderatable) {
      try {
        await message.member.timeout(config.muteDuration, 'Exceeded automatic warning limit');
        await message.channel.send(
          `🔇 ${message.author} has been muted for ${config.muteDuration / 60000} minutes due to repeated infractions.`
        );

        await logger(client, 'Automatic Mute', message.author, message.author, `Duration: ${config.muteDuration / 60000} minutes`);

        // Reseta os warnings
        user.warnings = 0;
        await user.save();
      } catch {
        // Ignora erros
      }
    }
  }
};
