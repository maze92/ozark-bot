let started = false;

module.exports = (client) => {
  client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);

    if (started) return;
    started = true;

    // Iniciar sistema de notícias automáticas
    const gameNews = require('../systems/gamenews');
    const config = require('../config/defaultConfig');

    if (config.gameNews.enabled) {
      gameNews(client, config);
      console.log('📰 Game News system started.');
    }
  });
};
