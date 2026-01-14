const logger = require('../systems/logger');

module.exports = {
  name: 'clear',
  description: 'Clear messages in the channel',
  allowedRoles: [
    '1385619241235120177',
    '1385619241235120174',
    '1385619241235120173'
  ],

  async execute(message, client, args) {
    if (!message.guild.members.me.permissions.has('ManageMessages'))
      return message.reply('❌ I do not have permission to manage messages.');

    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100)
      return message.reply('❌ Usage: !clear <1-100>');

    await message.channel.bulkDelete(amount, true);

    const reply = await message.channel.send(`🧹 Cleared **${amount}** messages.`);
    setTimeout(() => reply.delete().catch(() => null), 5000);

    await logger(client, 'Clear Messages', null, message.author, `Cleared ${amount} messages`, message.guild);
  }
};
