require('dotenv').config();
require('./database/connect'); // MongoDB

const fs = require('fs');
const client = require('./bot');

// ==============================
// Inicializar Commands Map
// ==============================
client.commands = new Map();

// Carregar todos os ficheiros de comandos
const commandFiles = fs
  .readdirSync('./src/commands')
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
  console.log(`Loaded command: ${command.name}`);
}

// ==============================
// Eventos (carregar APENAS UMA VEZ)
// ==============================
require('./events/ready')(client);
require('./events/messageCreate')(client);
require('./events/guildMemberAdd')(client);

// ==============================
// Login
// ==============================
client.login(process.env.TOKEN);

// ==============================
// Dashboard
// ==============================
const app = require('./dashboard');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Dashboard running on port ${PORT} 🚀`);
});
