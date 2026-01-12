// src/commands/ping.js
module.exports = {
  name: 'ping',
  permissions: [],

  async execute(message) {
    const sent = await message.channel.send('🏓 Pinging...');
    sent.edit(`🏓 Pong! Latency is ${sent.createdTimestamp - message.createdTimestamp}ms.`);
  }
};
