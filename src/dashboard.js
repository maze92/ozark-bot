'use strict';

// Minimal but valid dashboard.js to keep the bot running without syntax errors.
// It exposes an Express app + HTTP server that index.js can call `dashboard.server.listen(...)` on.
// The full dashboard routes/logic can ser reintroduzidos mais tarde, mas esta versão é estável.

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server, {
  cors: { origin: '*' }
});

function initializeDashboard() {
  // Coloca aqui qualquer configuração extra de middleware/rotas se necessário.
  return server;
}

async function ensureDefaultDashboardAdmin() {
  try {
    // Nesta versão mínima não criamos utilizadores por defeito.
    return;
  } catch (err) {
    console.error('[Dashboard Auth] Failed to ensure default admin', err);
  }
}

function setClient(client) {
  // Mantido apenas para não rebentar se index.js chamar dashboard.setClient(client).
  io.dashboardClient = client;
}

module.exports = {
  app,
  server,
  io,
  ensureDefaultDashboardAdmin,
  initializeDashboard,
  setClient
};
