// src/systems/commands.js
// ============================================================
// Handler central de comandos prefixados
// - Carrega comandos de /src/commands (uma vez)
// - Aplica cooldown
// - Aplica permissões por staffRoles (config) para comandos sensíveis
// - Assinatura padrão: execute(message, args, client)
// ============================================================

const fs = require('fs');
const path = require('path');
const { PermissionsBitField } = require('discord.js');

const config = require('../config/defaultConfig');
const checkCooldown = require('./cooldowns');

const commands = new Map();
const commandsDir = path.join(__dirname, '../commands');

let commandFiles = [];
try {
  commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
} catch (err) {
  console.error('[commands] Failed to read commands directory:', err);
}

for (const file of commandFiles) {
  const filePath = path.join(commandsDir, file);
  const cmd = require(filePath);

  if (!cmd?.name || typeof cmd.execute !== 'function') {
    console.warn(`[commands] Skipped invalid command file: ${file}`);
    continue;
  }

  commands.set(cmd.name.toLowerCase(), cmd);
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

  const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
  if (isAdmin) return true;

  const staffRoles = Array.isArray(config.staffRoles) ? config.staffRoles : [];
  if (staffRoles.length === 0) return false;

  return member.roles.cache.some(role => staffRoles.includes(role.id));
}

module.exports = async function commandsHandler(message, client) {
  try {
    if (!message?.content) return;
    if (!message.guild) return;
    if (message.author?.bot) return;

    if (message.partial) {
      try { await message.fetch(); } catch { return; }
    }

    const prefix = config.prefix || '!';
    if (!message.content.startsWith(prefix)) return;

    if (!message.member) {
      try { await message.guild.members.fetch(message.author.id); } catch {
        return message.reply('❌ Could not verify your roles.').catch(() => null);
      }
    }

    const args = message.content
      .slice(prefix.length)
      .trim()
      .split(/\s+/);

    const commandName = (args.shift() || '').toLowerCase();
    if (!commandName) return;

    const command = commands.get(commandName);
    if (!command) return;

    // cooldown
    const remaining = checkCooldown(commandName, message.author.id);
    if (remaining) {
      return message.reply(`⏳ Please slow down. Try again in **${remaining}s**.`).catch(() => null);
    }

    // staff-only
    if (STAFF_ONLY.has(commandName)) {
      if (!isStaff(message.member)) {
        return message.reply("❌ You don't have permission to use this command.").catch(() => null);
      }
    }

    await command.execute(message, args, client);

  } catch (err) {
    console.error('[commands] Critical error:', err);
    message.reply('⚠️ Error executing command.').catch(() => null);
  }
};
