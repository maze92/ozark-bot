'use strict';

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server, { cors: { origin: '*' } });

// ------------------------------
// Basic middleware
app.use(express.static(path.join(__dirname, '../public')));

// ------------------------------
app.use(express.json());

// ------------------------------
// Auth helpers (minimal)
// ------------------------------
function isAuthEnabled() {
  return !!process.env.DASHBOARD_JWT_SECRET;
}

async function decodeDashboardToken(token) {
  try {
    if (!process.env.DASHBOARD_JWT_SECRET) return null;
    return jwt.verify(token, process.env.DASHBOARD_JWT_SECRET);
  } catch {
    return null;
  }
}

function requireDashboardAuth(req, res, next) {
  if (!isAuthEnabled()) return next();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  decodeDashboardToken(token).then(decoded => {
    if (!decoded) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    req.dashboardUser = decoded;
    next();
  });
}

// ------------------------------
// Health
// ------------------------------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'dashboard', ts: Date.now() });
});

// ------------------------------
// Socket auth
// ------------------------------
io.use(async (socket, next) => {
  try {
    if (!isAuthEnabled()) return next();
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    const decoded = await decodeDashboardToken(token);
    if (!decoded) return next(new Error('Unauthorized'));
    socket.data.dashboardUser = decoded;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

// ------------------------------
// Wiring for GameNews routes (optional)
// ------------------------------
function tryRegisterGameNews() {
  try {
    const { registerGameNewsRoutes } = require('./dashboard/routes/gamenews');
    const gameNewsSystem = (() => { try { return require('./systems/gamenews'); } catch { return null; } })();
    const config = (() => { try { return require('./config/defaultConfig'); } catch { return {}; } })();
    const configManager = (() => { try { return require('./config/configManager'); } catch { return {}; } })();
    const { sanitizeId, sanitizeText } = (() => {
      try { return require('./utils/sanitize'); } catch { return { sanitizeId: v => v, sanitizeText: v => v }; }
    })();
    const rateLimit = () => (req, _res, next) => next();
    const recordAudit = async () => {};
    const getActorFromRequest = () => null;
    const _client = null;
    const GameNewsFeed = null;
    const GameNewsFeedSchema = null;

    registerGameNewsRoutes({
      app,
      requireDashboardAuth,
      rateLimit,
      GameNewsFeed,
      config,
      configManager,
      gameNewsSystem,
      GameNewsFeedSchema,
      sanitizeId,
      sanitizeText,
      recordAudit,
      getActorFromRequest,
      _client
    });
  } catch (e) {
    // Optional wiring; ignore if not present
  }
}

tryRegisterGameNews();

function initializeDashboard() {
  return server;
}

function setClient(client) {
  io.dashboardClient = client;
}

async function ensureDefaultDashboardAdmin() {
  return;
}

module.exports = {
  app,
  server,
  io,
  initializeDashboard,
  setClient,
  ensureDefaultDashboardAdmin
};
