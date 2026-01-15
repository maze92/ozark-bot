// src/events/guildMemberAdd.js

const User = require('../database/models/User');
const logger = require('../systems/logger');

/**
 * Evento: guildMemberAdd
 * 
 * Sempre que um utilizador entra no servidor (guild):
 * - Garantimos que existe um registo do utilizador na base de dados (MongoDB)
 * - Inicializamos valores default (warnings e trust)
 * - (Opcional) Fazemos log no canal log-bot + dashboard
 */
module.exports = (client) => {
  client.on('guildMemberAdd', async (member) => {
    try {
      // ------------------------------
      // Segurança extra: validações mínimas
      // ------------------------------
      if (!member) return;
      if (!member.guild) return;
      if (!member.user) return;

      const guildId = member.guild.id;
      const userId = member.id;

      // ------------------------------
      // Upsert (1 operação apenas)
      // - Se existir: não altera nada
      // - Se não existir: cria com defaults
      //
      // Isto evita 2 queries (findOne + create)
      // e previne duplicados em situações de múltiplos eventos/cache.
      // ------------------------------
      const result = await User.findOneAndUpdate(
        { userId, guildId }, // filtro (chave única)
        {
          $setOnInsert: {
            userId,
            guildId,
            trust: 30,     // confiança inicial
            warnings: 0    // começa sem avisos
          }
        },
        {
          upsert: true,         // cria se não existir
          new: false,           // não precisamos do doc atualizado
          setDefaultsOnInsert: true
        }
      );

      // Se result for null, significa que foi inserido agora (depende do Mongoose);
      // mas para ser simples e não falhar com diferenças de versão,
      // vamos fazer um log informativo sempre que entra alguém.
      console.log(
        `✅ Member joined: ${member.user.tag} (${member.id}) in guild ${member.guild.name}`
      );

      // ------------------------------
      // Log no canal log-bot + dashboard
      // (Não é obrigatório, mas é útil para auditoria)
      // ------------------------------
      await logger(
        client,
        'Member Joined',
        member.user,        // "user" afetado
        client.user,        // executor (o bot)
        `New member joined: **${member.user.tag}**\nGuild: **${member.guild.name}**`,
        member.guild
      );

    } catch (err) {
      console.error('[guildMemberAdd] Error:', err);
    }
  });
};
