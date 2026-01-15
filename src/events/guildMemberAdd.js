// src/events/guildMemberAdd.js

const User = require('../database/models/User');

module.exports = (client) => {
  client.on('guildMemberAdd', async (member) => {
    try {
      // ------------------------------
      // Segurança: garante que o membro pertence a uma guild
      // ------------------------------
      if (!member.guild) return;

      // ------------------------------
      // Verifica se o usuário já existe no banco de dados
      // ------------------------------
      const existing = await User.findOne({
        userId: member.id,
        guildId: member.guild.id
      });
      if (existing) return;

      // ------------------------------
      // Cria registro no MongoDB para o novo usuário
      // ------------------------------
      await User.create({
        userId: member.id,
        guildId: member.guild.id,
        trust: 30,      // confiança inicial
        warnings: 0     // sem warns ao entrar
      });

      console.log(
        `✅ Created user entry for ${member.user.tag} (${member.id}) in guild ${member.guild.name}`
      );
    } catch (err) {
      console.error('[guildMemberAdd] Error creating user entry:', err);
    }
  });
};
