require('dotenv').config();
require('./systems/errorGuard')();
require('./database/connect');

const path = require('path');
const fs = require('fs');
const client = require('./bot');

// Commands
client.commands = new Map();
const commandFiles = fs
  .readdirSync(path.join(__dirname, 'commands'))
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
  console.log(`✅ Loaded command: ${command.name}`);
}

// Events
require('./events/ready')(client);
require('./events/messageCreate')(client);
require('./events/guildMemberAdd')(client);

// Login
client.login(process.env.TOKEN);

// Dashboard
const app = require('./dashboard');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dashboard running on port ${PORT}`);
});
