const config = require('../config/defaultConfig');
const infractions = require('./infraction');

const messageMap = new Map();

module.exports = async function antiSpam(message, client) {
  if (!config.antiSpam?.enabled) return;
  if (!message.guild || message.author.bot) return;

  const userId = message.author.id;
  const now = Date.now();

  if (!messageMap.has(userId)) {
    messageMap.set(userId, []);
  }

  const timestamps = messageMap.get(userId).filter(
    time => now - time < config.antiSpam.interval
  );

  timestamps.push(now);
  messageMap.set(userId, timestamps);

  if (timestamps.length >= config.antiSpam.maxMessages) {
    messageMap.delete(userId);

    if (message.member?.moderatable) {
      await message.member.timeout(
        config.antiSpam.muteDuration,
        'Spam detected'
      ).catch(() => null);

      await infractions.create({
        client,
        guild: message.guild,
        user: message.author,
        moderator: client.user,
        type: 'MUTE',
        reason: 'Spam / Flood detected',
        duration: config.antiSpam.muteDuration
      });

      await message.channel.send(
        `🔇 ${message.author} muted for spam.`
      ).catch(() => null);
    }
  }
};
