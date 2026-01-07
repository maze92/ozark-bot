require('dotenv').config();
require('./database/connect'); // MongoDB

const client = require('./bot');

// ==============================
// Eventos (carregar APENAS UMA VEZ)
// ==============================
require('./events/ready')(client);
require('./events/messageCreate')(client);
require('./events/guildMemberAdd')(client);

client.login(process.env.TOKEN);

// ==============================
// Dashboard
// ==============================
const app = require('./dashboard');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Dashboard running on port ${PORT} 🚀`);
});

