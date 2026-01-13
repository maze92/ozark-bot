const User = require('../database/models/User');
const logger = require('../systems/logger');
const config = require('../config/defaultConfig');

module.exports = {
  name: 'resetwarns',
  description: 'Reset warnings for a user',
  allowedRoles: [
    '1385619241235120177',
    '1385619241235120174',
    '1385619241235120173'
  ],

  async execute(message, client, args) {
    const member = message.mentions.members.first();
    if (!member) {
      return message.reply(`❌ Usage: ${config.prefix}resetwarns @user`);
    }

    const user = await User.findOne({
      userId: member.id,
      guildId: message.guild.id
    });

    if (!user || user.warnings === 0) {
      return message.reply('ℹ️ This user has no warnings.');
    }

    user.warnings = 0;
    await user.save();

    await message.channel.send(
      `✅ Warnings reset for **${member.user.tag}**`
    );

    await logger(
      client,
      'Reset Warnings',
      member.user,
      message.author,
      'All warnings reset',
      message.guild
    );
  }
};
