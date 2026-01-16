// src/systems/commands.js
// ============================================================
// Handler central de comandos prefixados
// ------------------------------------------------------------
// Faz:
// - Carrega comandos de /src/commands (uma vez ao iniciar o bot)
// - Aplica cooldown (anti-spam de comandos)
// - Aplica permissões por staffRoles (config) para comandos sensíveis
// - Assinatura padrão dos comandos: execute(message, args, client)
// ============================================================

const fs = require('fs');
const path = require('path');
const { PermissionsBitField } = require('discord.js');

const config = require('../config/defaultConfig');
const checkCooldown = require('./cooldowns');

// Mapa interno de comandos: name -> objeto comando
const commands = new Map();

// Caminho da pasta de comandos
const commandsDir = path.join(__dirname, '../commands');

let commandFiles = [];
try {
  commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
} catch (err) {
  console.error('[commands] Failed to read commands directory:', err);
}

for (const file of commandFiles) {
  const filePath = path.join(commandsDir, file);

  try {
    const cmd = require(filePath);

    if (!cmd?.name || typeof cmd.execute !== 'function') {
      console.warn(`[commands] Skipped invalid command file: ${file}`);
      continue;
    }

    const key = cmd.name.toLowerCase();
    commands.set(key, cmd);
    console.log(`[commands] Loaded command: ${key} (${file})`);
  } catch (err) {
    console.error(`[commands] Error loading command file ${file}:`, err);
  }
}

/**
 * Comandos que exigem staffRoles (ou admin)
 * ✅ aqui controlas tudo num sítio
 */
const STAFF_ONLY = new Set(['clear', 'warn', 'mute', 'unmute']);

/**
 * Verifica se membro é staff (staffRoles) ou admin
 */
function isStaff(member) {
  if (!member) return false;

  const isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator);
  if (isAdmin) return true;

  const staffRoles = Array.isArray(config.staffRoles) ? config.staffRoles : [];
  if (staffRoles.length === 0) return false;

  return member.roles.cache.some(role => staffRoles.includes(role.id));
}

/**
 * Handler principal de comandos
 * @param {Message} message
 * @param {Client} client
 */
module.exports = async function commandsHandler(message, client) {
  try {
    if (!message?.content) return;
    if (!message.guild) return;
    if (message.author?.bot) return;

    // Partials
    if (message.partial) {
      try {
        await message.fetch();
      } catch {
        return;
      }
    }

    const prefix = config.prefix || '!';
    if (!message.content.startsWith(prefix)) return;

    // Garante member
    if (!message.member) {
      try {
        await message.guild.members.fetch(message.author.id);
      } catch {
        return message
          .reply('❌ Could not verify your roles.')
          .catch(() => null);
      }
    }

    // Parse comando + args
    const args = message.content
      .slice(prefix.length)
      .trim()
      .split(/\s+/);

    const commandName = (args.shift() || '').toLowerCase();
    if (!commandName) return;

    const command = commands.get(commandName);

    if (!command) {
      // Log de comando desconhecido (para debug)
      console.log(`[commands] Unknown command: "${commandName}" from ${message.author.tag}`);
      return;
    }

    console.log(`[commands] Command received: "${commandName}" from ${message.author.tag} (${message.author.id})`);

    // Cooldown
    const remaining = checkCooldown(commandName, message.author.id);
    if (remaining) {
      console.log(`[commands] Cooldown hit for "${commandName}" by ${message.author.tag}: ${remaining}s left`);
      return message
        .reply(`⏳ Please slow down. Try again in **${remaining}s**.`)
        .catch(() => null);
    }

    // Staff-only
    if (STAFF_ONLY.has(commandName)) {
      if (!isStaff(message.member)) {
        console.log(`[commands] Denied (no staff) for "${commandName}" by ${message.author.tag}`);
        return message
          .reply("❌ You don't have permission to use this command.")
          .catch(() => null);
      }
    }

    // Executar comando
    await command.execute(message, args, client);

  } catch (err) {
    console.error('[commands] Critical error:', err);
    message
      .reply('⚠️ Error executing command.')
      .catch(() => null);
  }
};
