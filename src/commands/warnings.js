// src/commands/warnings.js
const config = require('../config/defaultConfig');

module.exports = {
  name: 'warnings',
  permissions: [],

  async execute(message, args, client) {
    const user = message.mentions.members.first() || message.member;

    if (!user) return message.reply(`❌ Usage: ${config.prefix}warnings @user`);

    // Supondo que o autoModeration guarda warnings no User model
    const User = require('../database/models/User'); 
    const dbUser = await User.findOne({ discordId: user.id });

    const warnings = dbUser ? dbUser.warnings || 0 : 0;

    message.channel.send(
      `⚠️ ${user.user.tag} has ${warnings} warning(s).`
    );
  }
};
