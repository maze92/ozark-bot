// src/events/messageCreate.js

/**
 * Evento: messageCreate
 *
 * Responsável por:
 * - Processar comandos prefixados (ex: !mute, !warn, !clear, !unmute)
 * - Executar o sistema de auto-moderação em mensagens normais
 *
 * Regras:
 * - Se for comando, NÃO executa AutoMod (evita conflitos)
 * - Ignora bots e DMs
 * - Faz validações de permissões/cargos para comandos (allowedRoles)
 */

const { PermissionsBitField } = require('discord.js');
const autoModeration = require('../systems/autoModeration');
const config = require('../config/defaultConfig');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    try {
      // ------------------------------
      // Validações básicas
      // ------------------------------
      if (!message) return;
      if (!message.guild) return;          // Ignora DMs
      if (!message.content) return;
      if (message.author?.bot) return;     // Ignora bots

      // ------------------------------
      // Garantir dados completos (partials)
      // ------------------------------
      if (message.partial) {
        try {
          await message.fetch();
        } catch {
          return;
        }
      }

      // Garantir member (necessário para permissões/hierarquia)
      if (!message.member) {
        try {
          await message.guild.members.fetch(message.author.id);
        } catch {
          // Se falhar, comandos ainda podem funcionar,
          // mas checks de cargos/hierarquia podem não ter info completa
        }
      }

      const prefix = config.prefix || '!';

      // ------------------------------
      // 1) Processamento de comandos prefixados
      // ------------------------------
      if (message.content.startsWith(prefix)) {
        // Ex: "!" sozinho não faz nada
        if (message.content.trim() === prefix) return;

        // Separar args
        const args = message.content
          .slice(prefix.length)
          .trim()
          .split(/\s+/);

        const commandName = (args.shift() || '').toLowerCase();
        if (!commandName) return;

        // Buscar comando no Map carregado no index.js
        const command = client.commands.get(commandName);
        if (!command) return;

        // ------------------------------
        // Segurança: só permitir estes comandos
        // (evita que sobras antigas sejam executadas)
        // ------------------------------
        const allowedCommands = new Set(['clear', 'warn', 'mute', 'unmute']);
        if (!allowedCommands.has(commandName)) return;

        // ------------------------------
        // Check de permissões por cargos (allowedRoles)
        // - Admin bypass
        // ------------------------------
        const member = message.member;
        const isAdmin = member?.permissions?.has(PermissionsBitField.Flags.Administrator);

        if (!isAdmin && Array.isArray(command.allowedRoles) && command.allowedRoles.length > 0) {
          const hasRole = member?.roles?.cache?.some(role => command.allowedRoles.includes(role.id));
          if (!hasRole) {
            await message.reply("❌ You don't have permission to use this command.").catch(() => null);
            return;
          }
        }

        // Executar comando
        try {
          await command.execute(message, args, client);
        } catch (err) {
          console.error(`[Command Error] ${commandName}:`, err);
          await message.reply('❌ There was an error executing this command.').catch(() => null);
        }

        // Importante: comandos não passam pelo AutoMod
        return;
      }

      // ------------------------------
      // 2) AutoModeração (mensagens normais)
      // ------------------------------
      try {
        await autoModeration(message, client);
      } catch (err) {
        console.error('[AutoMod] Error in messageCreate:', err);
      }

    } catch (err) {
      console.error('[messageCreate] Critical error:', err);
    }
  });
};
