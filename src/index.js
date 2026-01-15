// src/index.js
// ============================================================
// Entrypoint principal do bot
// Faz:
// - Carrega variáveis .env
// - Inicializa ErrorGuard (handlers globais anti-crash)
// - Liga ao MongoDB
// - Carrega comandos (src/commands/*.js)
// - Regista eventos (ready, messageCreate, guildMemberAdd)
// - Inicia dashboard (porta HTTP para Railway manter "Running")
// - Faz login no Discord
// - Inicia GameNews apenas quando o bot estiver pronto (clientReady)
// ============================================================

require('dotenv').config();               // Carrega variáveis do .env

// ✅ ErrorGuard regista process.on(...) uma única vez
require('./systems/errorGuard')();

// ✅ Liga ao MongoDB (conforme o teu ficheiro connect.js)
require('./database/connect');

const path = require('path');
const fs = require('fs');

const client = require('./bot');           // Discord Client
const dashboard = require('./dashboard');  // Express + Socket.IO
const config = require('./config/defaultConfig');

// ============================================================
// 1) Carregar comandos (uma vez)
// - Os comandos ficam em src/commands/*.js
// - Cada comando deve exportar: { name, execute(message, args, client) }
// ============================================================
client.commands = new Map();

const commandsDir = path.join(__dirname, 'commands');

let commandFiles = [];
try {
  commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));
} catch (err) {
  console.error('[Index] Failed to read commands directory:', err);
}

for (const file of commandFiles) {
  const filePath = path.join(commandsDir, file);
  const command = require(filePath);

  // Validação básica para evitar crash por ficheiro mal exportado
  if (!command?.name || typeof command.execute !== 'function') {
    console.warn(`[Index] Skipped invalid command file: ${file}`);
    continue;
  }

  client.commands.set(command.name.toLowerCase(), command);
  console.log(`✅ Loaded command: ${command.name}`);
}

// ============================================================
// 2) Registar eventos (uma vez)
// - Commands + AutoMod + AntiSpam são tratados no events/messageCreate.js
// - NÃO registar messageCreate noutro sítio para não duplicar handlers
// ============================================================
require('./events/ready')(client);
require('./events/messageCreate')(client);
require('./events/guildMemberAdd')(client);

// ============================================================
// 3) Dashboard (server HTTP)
// - Railway precisa de uma porta aberta para manter serviço "Running"
// - A rota /health serve para "health check"
// ============================================================
dashboard.app.get('/health', (req, res) => {
  res.status(200).send('Bot is running ✅');
});

const PORT = process.env.PORT || 3000;

dashboard.server.listen(PORT, () => {
  console.log(`🚀 Dashboard running on port ${PORT}`);
});

// ============================================================
// 4) Login do bot
// ============================================================
if (!process.env.TOKEN) {
  console.error('❌ Missing TOKEN in .env');
  process.exit(1);
}

client.login(process.env.TOKEN).catch((err) => {
  console.error('❌ Discord login failed:', err);
});

// ============================================================
// 5) GameNews
// - Inicia apenas quando o client estiver pronto (clientReady)
// - Evita iniciar duas vezes (proteção extra)
// ============================================================
let gameNewsStarted = false;

client.once('clientReady', async () => {
  try {
    if (gameNewsStarted) return;
    gameNewsStarted = true;

    if (config.gameNews?.enabled) {
      const gameNews = require('./systems/gamenews');

      // gamenews tem setInterval interno, por isso basta chamar uma vez
      gameNews(client, config);

      console.log('📰 Game News system started.');
    } else {
      console.log('📰 Game News disabled in config.');
    }
  } catch (err) {
    console.error('[GameNews] Failed to start:', err);
  }
});

// ============================================================
// 6) Health check interno (opcional)
// - Aqui NÃO tentamos relogar em loop
// - Em Railway/PM2 o correto é deixar o process manager reiniciar
// ============================================================
setInterval(() => {
  if (!client.isReady()) {
    console.warn('[HealthCheck] Client not ready (disconnected or reconnecting).');
  }
}, 60 * 1000);
