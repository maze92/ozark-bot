// src/systems/commands.js
// ============================================================
// Sistema centralizado de comandos (prefixados)
// Faz:
// - Carrega comandos da pasta /src/commands (uma vez)
// - Interpreta mensagens com prefix (ex: !clear, !mute)
// - Aplica cooldown (anti-spam) por utilizador e por comando
// - Aplica permissões por cargos (allowedRoles) e/ou config.staffRoles
// - Executa o comando com assinatura padrão: execute(message, args, client)
// ============================================================

const fs = require('fs');
const path = require('path');
const config = require('../config/defaultConfig');
const checkCooldown = require('./cooldowns');

// Map interno de comandos (carregado uma vez ao iniciar o bot)
const commands = new Map();

// ------------------------------------------------------------
// Carregar comandos do /src/commands
// Nota: __dirname aqui é /src/systems, por isso ../commands aponta para /src/commands
// ------------------------------------------------------------
const commandsDir = path.join(__dirname, '../commands');

let commandFiles = [];
try {
  commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));
} catch (err) {
  console.error('[commands] Failed to read commands directory:', err);
}

for (const file of commandFiles) {
  const filePath = path.join(commandsDir, file);

  // require() com path absoluto evita problemas de path em Railway
  const command = require(filePath);

  // Validação mínima do "formato" do comando
  if (!command?.name || typeof command.execute !== 'function') {
    console.warn(`[commands] Skipped invalid command file: ${file}`);
    continue;
  }

  commands.set(command.name.toLowerCase(), command);
}

/**
 * Handler principal de comandos
 * @param {Message} message - Mensagem do Discord
 * @param {Client} client - Client do Discord.js
 */
module.exports = async function commandsHandler(message, client) {
  try {
    // ------------------------------------------------------------
    // Validações básicas
    // ------------------------------------------------------------
    if (!message?.content) return;
    if (!message.guild) return;           // Ignora DMs
    if (message.author?.bot) return;      // Ignora bots

    // ------------------------------------------------------------
    // Partials: por vezes a mensagem chega incompleta
    // ------------------------------------------------------------
    if (message.partial) {
      try {
        await message.fetch();
      } catch {
        return;
      }
    }

    const prefix = config.prefix || '!';
    if (!message.content.startsWith(prefix)) return;

    // ------------------------------------------------------------
    // Parse do comando e argumentos
    // Ex: "!mute @user 10m reason..." -> commandName="mute", args=[...]
    // ------------------------------------------------------------
    const args = message.content
      .slice(prefix.length)
      .trim()
      .split(/\s+/);

    const commandName = (args.shift() || '').toLowerCase();
    if (!commandName) return;

    const command = commands.get(commandName);
    if (!command) return;

    // ------------------------------------------------------------
    // (Opcional) Whitelist de comandos
    // Se quiseres forçar apenas certos comandos, ativa abaixo.
    // ------------------------------------------------------------
    // const allowedCommands = new Set(['clear', 'warn', 'mute', 'unmute']);
    // if (!allowedCommands.has(commandName)) return;

    // ------------------------------------------------------------
    // Garantir member (necessário para roles/permissões)
    // ------------------------------------------------------------
    if (!message.member) {
      try {
        await message.guild.members.fetch(message.author.id);
      } catch {
        // Se falhar, não conseguimos validar roles -> por segurança bloqueamos
        return message.reply('❌ I could not verify your roles. Please try again.').catch(() => null);
      }
    }

    // ------------------------------------------------------------
    // Cooldown por comando (configurável no defaultConfig.js)
    // - usa config.cooldowns[commandName] ou config.cooldowns.default
    // ------------------------------------------------------------
    const remaining = checkCooldown(commandName, message.author.id);
    if (remaining) {
      return message
        .reply(`⏳ Please slow down. Try again in **${remaining}s**.`)
        .catch(() => null);
    }

    // ------------------------------------------------------------
    // Permissões por cargos
    //
    // Regras:
    // 1) Se o comando tiver "allowedRoles", usa essas.
    // 2) Se NÃO tiver allowedRoles, mas existir config.staffRoles,
    //    então comandos "sensíveis" podem exigir staffRoles (opcional).
    //
    // Nota:
    // - Eu deixo o comportamento padrão como:
    //   ✅ se o comando define allowedRoles -> aplica
    //   ✅ se não define -> não bloqueia
    //
    // Se quiseres que TODOS os comandos exijam staffRoles,
    // diz-me e eu ajusto.
    // ------------------------------------------------------------
    const allowedRoles = Array.isArray(command.allowedRoles) ? command.allowedRoles : null;

    if (allowedRoles && allowedRoles.length > 0) {
      const hasAllowedRole = message.member.roles.cache.some((role) =>
        allowedRoles.includes(role.id)
      );

      if (!hasAllowedRole) {
        return message
          .reply("❌ You do not have permission to use this command.")
          .catch(() => null);
      }
    }

    // ------------------------------------------------------------
    // Executar comando
    // Assinatura padrão: execute(message, args, client)
    // ------------------------------------------------------------
    await command.execute(message, args, client);

  } catch (err) {
    console.error('[commands] Critical error:', err);
    await message.reply('⚠️ Error executing command.').catch(() => null);
  }
};
