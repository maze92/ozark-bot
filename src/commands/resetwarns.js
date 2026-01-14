const logger = require('../systems/logger');
const User = require('../database/models/User');

module.exports = {
  name: 'resetwarns',
  description: 'Reset warnings of a user',
  allowedRoles: [
    '1385619241235120177',
    '1385619241235120174',
    '1385619241235120173'
  ],

  async execute(message, client, args) {
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Please mention a user.');

    let dbUser = await User.findOne({ userId: user.id, guildId: message.guild.id });
    if (!dbUser) dbUser = await User.create({ userId: user.id, guildId: message.guild.id, warnings: 0 });

    dbUser.warnings = 0;
    await dbUser.save();

    await message.channel.send(`✅ Warnings for ${user.user.tag} have been reset.`);
    await logger(client, 'Reset Warnings', user, message.author, 'Warnings reset to 0', message.guild);
  }
};
