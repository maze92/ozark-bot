// src/commands/leaderboard.js
const User = require('../database/models/User');

module.exports = {
  name: 'leaderboard',
  permissions: [],

  async execute(message) {
    const topUsers = await User.find({}).sort({ warnings: -1 }).limit(10);

    if (!topUsers.length) return message.channel.send('No users with warnings yet.');

    const leaderboard = topUsers
      .map((u, i) => `${i + 1}. <@${u.discordId}> — ${u.warnings} warning(s)`)
      .join('\n');

    message.channel.send(`📋 **Warnings Leaderboard**\n${leaderboard}`);
  }
};
