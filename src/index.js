// src/index.js
// ============================================================
// Entrypoint principal do bot
// - Carrega config e DB
// - Carrega comandos e eventos
// - Inicia dashboard (porta aberta para Railway manter "Running")
// - Inicia GameNews (apenas após o bot estar pronto)
// - Inclui handlers de estabilidade (anti-crash)
// ============================================================

require('dotenv').config();              // Carrega variáveis do .env
require('./database/connect');           // Liga ao MongoDB

const path = require('path');
const fs = require('fs');

const client = require('./bot');          // Discord Client
const dashboard = require('./dashboard'); // Express + Socket.IO
const config = require('./config/defaultConfig');

// ============================================================
// 1) Carregar comandos (uma vez)
// - Os comandos ficam em src/commands/*.js
// - Cada comando deve exportar: { name, execute(...) }
// ============================================================
client.commands = new Map();

const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsDir)
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsDir, file);
  const command = require(filePath);

  // Validação básica para evitar crash por ficheiro mal exportado
  if (!command?.name || typeof command.execute !== 'function') {
    console.warn(`⚠️ Skipped invalid command file: ${file}`);
    continue;
  }

  client.commands.set(command.name, command);
  console.log(`✅ Loaded command: ${command.name}`);
}

// ============================================================
// 2) Carregar eventos (uma vez)
// - O AutoMod e comandos são tratados no events/messageCreate.js
// - Não registar messageCreate noutro sítio para não duplicar handlers
// ============================================================
require('./events/ready')(client);
require('./events/messageCreate')(client);
require('./events/guildMemberAdd')(client);

// ============================================================
// 3) Handlers de estabilidade (evitar crash silencioso)
// ============================================================
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

// ============================================================
// 4) Dashboard (server HTTP)
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
// 5) Login do bot
// ============================================================
if (!process.env.TOKEN) {
  console.error('❌ Missing TOKEN in .env');
  process.exit(1);
}

client.login(process.env.TOKEN).catch(err => {
  console.error('❌ Discord login failed:', err);
});

// ============================================================
// 6) GameNews
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

      // Nota: gamenews usa setInterval internamente,
      // portanto não precisamos "await" para bloquear nada.
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
// 7) Health check interno (opcional)
// - Aqui NÃO tentamos relogar em loop
// - Em Railway/PM2 o correto é deixar o process manager reiniciar
// ============================================================
setInterval(() => {
  if (!client.isReady()) {
    console.warn('[HealthCheck] Client not ready (disconnected or reconnecting).');
  }
}, 60 * 1000);

