// src/systems/status.js

const status = {
  discordReady: false,
  mongoConnected: false,
  gameNewsRunning: false,
  startedAt: Date.now()
};

function getStatus() {
  const now = Date.now();

  return {
    ok: status.discordReady && status.mongoConnected,
    discordReady: status.discordReady,
    mongoConnected: status.mongoConnected,
    gameNewsRunning: status.gameNewsRunning,
    uptimeSeconds: Math.floor((now - status.startedAt) / 1000),
    startedAt: new Date(status.startedAt).toISOString()
  };
}

function setDiscordReady(value = true) {
  status.discordReady = Boolean(value);
}

function setMongoConnected(value = true) {
  status.mongoConnected = Boolean(value);
}

function setGameNewsRunning(value = true) {
  status.gameNewsRunning = Boolean(value);
}

module.exports = {
  getStatus,
  setDiscordReady,
  setMongoConnected,
  setGameNewsRunning
};
