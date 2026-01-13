const fs = require('fs');
const path = require('path');
const config = require('../config/defaultConfig');
const rateLimit = require('./rateLimit');

const commands = new Map();

const commandFiles = fs
  .readdirSync(path.join(__dirname, '../commands'))
  .filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

module.exports = async (message, client) => {
  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content
    .slice(config.prefix.length)
    .trim()
    .split(/\s+/);

  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);
  if (!command) return;

  // Rate limit (3s por comando)
  if (rateLimit(message.author.id, command.name, 3000)) {
    return message.reply('⏳ Please slow down.');
  }

  // Verificação de cargos
  if (command.allowedRoles) {
    const allowed = message.member.roles.cache.some(role =>
      command.allowedRoles.includes(role.id)
    );

    if (!allowed) {
      return message.reply('❌ You do not have permission to use this command.');
    }
  }

  try {
    await command.execute(message, client, args);
  } catch (err) {
    console.error(`[COMMAND ERROR] ${commandName}:`, err);
    message.reply('⚠️ Error executing command.');
  }
};
