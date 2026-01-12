const fs = require('fs');
const path = require('path');
const config = require('../config/defaultConfig');

const commands = new Map();

// Carregar comandos do /src/commands
const commandFiles = fs
  .readdirSync(path.join(__dirname, '../commands'))
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(__dirname, '../commands', file));
  commands.set(command.name, command);
}

// Handler de execução de comandos
module.exports = async (message, client) => {
  // Ignorar bots e mensagens sem prefixo
  if (!message.content.startsWith(config.prefix) || message.author.bot) return;

  const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);
  if (!command) return;

  // ==============================
  // Verificação de permissões por cargo
  // ==============================
  if (command.allowedRoles) {
    const hasRole = message.member.roles.cache.some(role =>
      command.allowedRoles.includes(role.id)
    );

    if (!hasRole) {
      return message.reply({
        content: "❌ You don't have permission to use this command.",
        allowedMentions: { repliedUser: true }
      });
    }
  }

  // ==============================
  // Executar comando
  // ==============================
  try {
    await command.execute(message, client, args);
  } catch (err) {
    console.error(`Error executing command ${commandName}:`, err);
    message.reply('⚠️ There was an error executing that command.');
  }
};
