'use strict';

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server, {
  cors: { origin: '*' }
});

// Bot client (Discord.js) injected from index.js
let botClient = null;

function setClient(client) {
  botClient = client;
}

function initializeDashboard() {
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Static files (public/index.html + assets)
  app.use(express.static(path.join(__dirname, '../public')));

  // Health endpoint used by the frontend badge
  app.get('/health', (req, res) => {
    const discordReady = !!(botClient && botClient.isReady && botClient.isReady());
    res.json({
      ok: true,
      discordReady
    });
  });

  // Minimal guilds listing for the guild selector
  app.get('/api/guilds', (req, res) => {
    if (!botClient) {
      return res.status(503).json({ ok: false, error: 'Bot client not ready' });
    }
    try {
      const items = botClient.guilds.cache.map(g => ({
        id: g.id,
        name: g.name
      }));
      res.json({ ok: true, items });
    } catch (err) {
      console.error('[Dashboard] /api/guilds error', err);
      res.status(500).json({ ok: false, error: 'Internal Server Error' });
    }
  });

  // Overview metrics (very minimal)
  app.get('/api/overview', (req, res) => {
    if (!botClient) {
      return res.json({
        ok: true,
        guilds: 0,
        users: 0,
        actions24h: 0
      });
    }
    try {
      const guilds = botClient.guilds.cache.size;
      let users = 0;
      botClient.guilds.cache.forEach(g => {
        users += g.memberCount || 0;
      });
      res.json({
        ok: true,
        guilds,
        users,
        actions24h: 0
      });
    } catch (err) {
      console.error('[Dashboard] /api/overview error', err);
      res.status(500).json({ ok: false, error: 'Internal Server Error' });
    }
  });

  return server;
}

// Placeholder: no-op, kept for compatibility with previous code
async function ensureDefaultDashboardAdmin() {
  return;
}

function sendToDashboard(event, payload) {
  try {
    io.emit(event, payload);
  } catch (err) {
    console.error('[Dashboard] sendToDashboard error', err);
  }
}

module.exports = {
  app,
  server,
  io,
  initializeDashboard,
  setClient,
  ensureDefaultDashboardAdmin,
  sendToDashboard
};
