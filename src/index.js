// src/index.js

require('dotenv').config();
require('./systems/errorGuard')();
require('./database/connect');

const client = require('./bot');
const dashboard = require('./dashboard');
const config = require('./config/defaultConfig');

const status = require('./systems/status');

require('./events/ready')(client);
require('./events/messageCreate')(client);
require('./events/guildMemberAdd')(client);

client.once('clientReady', async () => {
  status.setDiscordReady(true);
});

const PORT = process.env.PORT || 3000;
dashboard.server.listen(PORT, () => {
  console.log(`🚀 Dashboard running on port ${PORT}`);
});

if (!process.env.TOKEN) {
  console.error('❌ Missing TOKEN in environment');
  process.exit(1);
}

client.login(process.env.TOKEN).catch((err) => {
  console.error('❌ Discord login failed:', err);
});

let gameNewsStarted = false;
client.once('clientReady', async () => {
  try {
    if (gameNewsStarted) return;
    gameNewsStarted = true;

    if (config.gameNews?.enabled) {
      const gameNews = require('./systems/gamenews');
      await gameNews(client, config);
      console.log('📰 Game News system started.');
      status.setGameNewsRunning(true);
    }
  } catch (err) {
    console.error('[GameNews] Failed to start:', err);
  }
});
