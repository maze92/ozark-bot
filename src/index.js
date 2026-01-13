require('dotenv').config();            // Carrega variáveis de ambiente do .env
require('./database/connect');         // Conexão ao MongoDB

const path = require('path');
const fs = require('fs');
const client = require('./bot');       // Instância do Discord Client
const dashboard = require('./dashboard'); // Dashboard do bot (HTTP + Socket.io)

// Inicializar Map de Comandos
client.commands = new Map();

// Carregar comandos do /src/commands
const commandFiles = fs
  .readdirSync(path.join(__dirname, 'commands')) // Certifica-te que os comandos estão na pasta /src/commands
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'commands', file));
  client.commands.set(command.name, command);
  console.log(`✅ Loaded command: ${command.name}`);
}

// Carregar Eventos
require('./events/ready')(client);
require('./events/messageCreate')(client);
require('./events/guildMemberAdd')(client);

// Login do Bot
client.login(process.env.TOKEN);

// Dashboard (Health Check)
const PORT = process.env.PORT || 3000;

// O listen é feito no server que está exportado do dashboard.js
dashboard.server.listen(PORT, () => {
  console.log(`🚀 Dashboard running on port ${PORT}`);
});
