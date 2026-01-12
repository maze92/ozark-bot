const logger = require('../systems/logger');
const config = require('../config/defaultConfig');

module.exports = {
  name: 'purgeuser',
  description: 'Deletes recent messages from a specific user',
  allowedRoles: ['1385619241235120177', '1385619241235120174', '1385619241235120173'], // substitui pelos IDs dos cargos permitidos

  async execute(message, client, args) {
    // Checa se o bot tem permissão
    if (!message.guild.members.me.permissions.has('ManageMessages')) {
      return message.reply('❌ I do not have permission to manage messages.');
    }

    // Obtém o usuário mencionado
    const user = message.mentions.members.first();
    if (!user) return message.reply(`❌ Usage: ${config.prefix}purgeuser @user`);

    try {
      // Busca últimas 100 mensagens do canal
      const messages = await message.channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(m => m.author.id === user.id);

      if (!userMessages.size) return message.reply('⚠️ No messages found for this user.');

      // Deleta mensagens
      await message.channel.bulkDelete(userMessages, true);

      const reply = await message.channel.send(
        `🧹 Deleted ${userMessages.size} messages from ${user.user.tag}.`
      );
      setTimeout(() => reply.delete().catch(() => null), 5000);

      // Log automático
      await logger(client, 'Purge User', user.user, message.author, `Amount: ${userMessages.size}`);
    } catch (err) {
      console.error(err);
      message.reply('❌ Could not delete some messages (older than 14 days or higher role).');
    }
  }
};
