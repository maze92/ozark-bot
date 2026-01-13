const User = require('../database/models/User');
const config = require('../config/defaultConfig');

module.exports = {
  name: 'infractions',
  description: 'View user warnings',
  allowedRoles: [
    '1385619241235120177',
    '1385619241235120174',
    '1385619241235120173'
  ],

  async execute(message, client, args) {
    const member = message.mentions.members.first();
    if (!member) {
      return message.reply(`❌ Usage: ${config.prefix}infractions @user`);
    }

    const user = await User.findOne({
      userId: member.id,
      guildId: message.guild.id
    });

    const warns = user?.warnings || 0;

    message.reply(
      `📄 **Infractions for ${member.user.tag}**\n⚠️ Warnings: **${warns}/${config.maxWarnings}**`
    );
  }
};
