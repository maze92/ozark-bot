// src/dashboard.js
// ============================================================
// Dashboard (Express + Socket.IO)
// - /health (para Railway)
// - Serve /public com auth por token
// - Socket.IO com auth por token
// - Logs em memória + persistência no MongoDB
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

let logs = []; // cache em memória (mais recente primeiro)

/**
 * Lê token da query ou header
 */
function getTokenFromReq(req) {
  const q = req.query?.token;
  const h = req.headers['x-dashboard-token'];
  return q || h || null;
}

/**
 * Auth para HTTP
 */
function dashboardAuth(req, res, next) {
  if (!config.dashboard?.enabled) return res.status(404).send('Dashboard disabled');
  if (!config.dashboard?.requireAuth) return next();

  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) return res.status(503).send('Missing DASHBOARD_TOKEN');

  const provided = getTokenFromReq(req);
  if (!provided || provided !== expected) {
    return res.status(401).send('Unauthorized');
  }

  next();
}

// health público (Railway)
app.get('/health', (req, res) => {
  res.status(200).send('Bot is running ✅');
});

// rotas do dashboard protegidas
app.use(dashboardAuth);
app.use(express.static(path.join(__dirname, '../public')));

/**
 * Auth para Socket.IO
 */
io.use((socket, next) => {
  if (!config.dashboard?.requireAuth) return next();

  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) return next(new Error('Missing DASHBOARD_TOKEN'));

  const provided = socket.handshake.auth?.token;
  if (!provided || provided !== expected) return next(new Error('Unauthorized'));

  next();
});

/**
 * Carrega últimos logs do MongoDB ao iniciar
 */
async function preloadLogsFromDb() {
  try {
    const max = Number(config.dashboard?.maxLogs ?? 200);

    const docs = await DashboardLog.find({})
      .sort({ time: -1 })
      .limit(max)
      .lean();

    logs = docs.map(d => ({
      title: d.title,
      description: d.description,
      user: d.user,
      executor: d.executor,
      guild: d.guild,
      time: d.time
    }));
  } catch (err) {
    console.error('[Dashboard] preloadLogsFromDb failed:', err?.message || err);
  }
}
preloadLogsFromDb().catch(() => null);

// Socket events
io.on('connection', (socket) => {
  console.log('🔌 Dashboard client connected');

  socket.emit('logs', logs);

  socket.on('requestLogs', () => {
    socket.emit('logs', logs);
  });

  socket.on('disconnect', () => {
    console.log('❌ Dashboard client disconnected');
  });
});

/**
 * API: envia log para dashboard e guarda na DB
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

  if (!payload.guild?.id) return;

  // memória
  logs.unshift(payload);

  const max = Number(config.dashboard?.maxLogs ?? 200);
  if (logs.length > max) logs = logs.slice(0, max);

  // sockets
  io.emit('logs', logs);

  // persistência
  DashboardLog.create({
    title: payload.title,
    description: payload.description,
    user: payload.user,
    executor: payload.executor,
    guild: payload.guild,
    time: payload.time
  }).catch((err) => {
    console.error('[Dashboard] persist failed:', err?.message || err);
  });
}

module.exports = { app, server, sendToDashboard };

