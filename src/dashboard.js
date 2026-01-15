// src/dashboard.js
// ============================================================
// Dashboard (Express + Socket.IO)
// Faz:
// - Serve /public (UI do dashboard)
// - /health para Railway
// - Auth por token (DASHBOARD_TOKEN)
// - Guarda logs em memória + MongoDB
// - Ao conectar, envia logs persistidos (últimos N)
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const config = require('./config/defaultConfig');
const DashboardLog = require('./database/models/DashboardLog');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Cache em memória (rápido) — espelha o que está na DB
let logs = [];

/**
 * Lê token do request (query ou header)
 */
function getTokenFromReq(req) {
  const q = req.query?.token;
  const h = req.headers['x-dashboard-token'];
  return q || h || null;
}

/**
 * Middleware de auth para rotas HTTP (dashboard)
 * - Se config.dashboard.requireAuth = true, exige token
 * - Token vem do env DASHBOARD_TOKEN
 */
function dashboardAuth(req, res, next) {
  if (!config.dashboard?.requireAuth) return next();

  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) {
    // Se não definires token, por segurança bloqueia (ou muda para allow)
    return res.status(503).send('Dashboard auth misconfigured (missing DASHBOARD_TOKEN).');
  }

  const provided = getTokenFromReq(req);
  if (!provided || provided !== expected) {
    return res.status(401).send('Unauthorized (missing/invalid token).');
  }

  return next();
}

// ------------------------------------------------------------
// Static files (dashboard UI)
// Protegemos tudo com auth
// ------------------------------------------------------------
app.use(dashboardAuth);
app.use(express.static(path.join(__dirname, '../public')));

// Health check (não precisa auth para Railway — opcional)
// Se quiseres público, mete esta rota antes do app.use(dashboardAuth)
app.get('/health', (req, res) => {
  res.status(200).send('Bot is running ✅');
});

// ------------------------------------------------------------
// Socket.IO auth
// - o browser envia token via: io({ auth: { token } })
// ------------------------------------------------------------
io.use((socket, next) => {
  if (!config.dashboard?.requireAuth) return next();

  const expected = process.env.DASHBOARD_TOKEN;
  const provided = socket.handshake.auth?.token;

  if (!expected) return next(new Error('Dashboard auth misconfigured'));
  if (!provided || provided !== expected) return next(new Error('Unauthorized'));

  next();
});

// ------------------------------------------------------------
// Ao iniciar, carregar últimos logs do MongoDB
// ------------------------------------------------------------
async function preloadLogsFromDb() {
  try {
    const max = Number(config.dashboard?.maxLogs ?? 200);

    const docs = await DashboardLog
      .find({})
      .sort({ time: -1 })
      .limit(max)
      .lean();

    // docs vem do mais recente para o mais antigo
    // mas a UI já faz reverse, então guardamos como vem
    logs = docs.map(d => ({
      title: d.title,
      description: d.description,
      user: d.user,
      executor: d.executor,
      guild: d.guild,
      time: d.time
    }));
  } catch (err) {
    console.error('[Dashboard] Failed to preload logs:', err?.message || err);
  }
}
preloadLogsFromDb().catch(() => null);

// ------------------------------------------------------------
// Socket.io handlers
// ------------------------------------------------------------
io.on('connection', (socket) => {
  console.log('🔌 Dashboard client connected');

  // Envia logs atuais
  socket.emit('logs', logs);

  // Cliente pode pedir refresh
  socket.on('requestLogs', () => {
    socket.emit('logs', logs);
  });

  socket.on('disconnect', () => {
    console.log('❌ Dashboard client disconnected');
  });
});

/**
 * Envia logs para o dashboard e persiste no MongoDB.
 * Espera: sendToDashboard('log', data)
 */
async function sendToDashboard(event, data) {
  if (event !== 'log') return;

  const payload = {
    title: data?.title || 'Log',
    description: data?.description || '',
    user: data?.user || null,
    executor: data?.executor || null,
    guild: data?.guild || null,
    time: data?.time ? new Date(data.time) : new Date()
  };

  if (!payload.guild?.id) {
    // sem guild não guardamos (evita lixo)
    return;
  }

  // 1) guarda em memória
  logs.unshift(payload);
  const max = Number(config.dashboard?.maxLogs ?? 200);
  if (logs.length > max) logs = logs.slice(0, max);

  // 2) emite para sockets
  io.emit('logs', logs);

  // 3) persiste na DB (não bloqueia o bot se falhar)
  DashboardLog.create({
    title: payload.title,
    description: payload.description,
    user: payload.user,
    executor: payload.executor,
    guild: payload.guild,
    time: payload.time
  }).catch((err) => {
    console.error('[Dashboard] Failed to persist log:', err?.message || err);
  });
}

module.exports = {
  app,
  server,
  sendToDashboard
};
