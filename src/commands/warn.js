const logger = require('../systems/logger');
const User = require('../database/models/User');

module.exports = {
  name: 'warn',
  description: 'Issue a warning to a user',
  allowedRoles: [
    '1385619241235120177',
    '1385619241235120174',
    '1385619241235120173'
  ],

  async execute(message, client, args) {
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Please mention a user to warn.');

    let dbUser = await User.findOne({ userId: user.id, guildId: message.guild.id });
    if (!dbUser) dbUser = await User.create({ userId: user.id, guildId: message.guild.id, warnings: 0 });

    dbUser.warnings += 1;
    await dbUser.save();

    await message.channel.send(`⚠️ ${user} has been warned. Total warns: ${dbUser.warnings}`);

    await logger(client, 'Manual Warn', user, message.author, `Total warns: ${dbUser.warnings}`, message.guild);
  }
};
