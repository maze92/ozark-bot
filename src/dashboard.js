// src/dashboard.js

/**
 * v.1.0.0.1
 * ------------------------------------------------------------
 * Resumo:
 * - Servidor do Dashboard (Express + Socket.IO)
 * - API de logs e status do GameNews
 * - Comunicação em tempo real com o bot
 *
 * Notas:
 * - Suporte opcional a autenticação por token
 * - Cache em memória + persistência em MongoDB
 * ------------------------------------------------------------
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const status = require('./systems/status');

const config = require('./config/defaultConfig');
let DashboardLog = null;
let GameNewsModel = null;

// tenta carregar o model DashboardLog (pode falhar se o ficheiro não existir)
try {
  DashboardLog = require('./database/models/DashboardLog');
} catch (e) {
  console.warn('[Dashboard] DashboardLog model not loaded (did you create src/database/models/DashboardLog.js?)');
}

// tenta carregar o model GameNews (para status por feed)
try {
  GameNewsModel = require('./database/models/GameNews');
} catch (e) {
  console.warn('[Dashboard] GameNews model not loaded (did you create src/database/models/GameNews.js?)');
}

const app = express();
const server = http.createServer(app);

// socket.IO com CORS permissivo (Railway/Browser)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// logs em memória (para live + fallback)
const MAX_MEMORY_LOGS = config.dashboard?.maxLogs ?? 200;
let logsCache = [];

// cache em memória para GameNews status
let gameNewsStatusCache = []; // array de feeds

// * se DASHBOARD_TOKEN existir: exige token
function isAuthEnabled() {
  return Boolean(process.env.DASHBOARD_TOKEN);
}

function extractToken(req) {
  // header: Authorization: Bearer <token>
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  // header: x-dashboard-token: <token>
  const x = req.headers['x-dashboard-token'];
  if (typeof x === 'string' && x.trim()) return x.trim();

  // query: ?token=<token> (não recomendado, mas útil para debug)
  if (typeof req.query.token === 'string' && req.query.token.trim()) return req.query.token.trim();

  return null;
}

function requireDashboardAuth(req, res, next) {
  if (!isAuthEnabled()) return next();

  const token = extractToken(req);
  if (!token || token !== process.env.DASHBOARD_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  next();
}

// * static files (public)
app.use(express.static(path.join(__dirname, '../public')));

// * health check
app.get('/health', (req, res) => {
  try {
    const s = status.getStatus();

    const payload = {
      ok: true,
      discordReady: Boolean(s.discordReady),
      mongoConnected: Boolean(s.mongoConnected),
      gameNewsRunning: Boolean(s.gameNewsRunning),
      uptimeSeconds: Math.floor(process.uptime())
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error('[Dashboard] /health error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Health check failed'
    });
  }
});

// * API: GET /api/logs
app.get('/api/logs', requireDashboardAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limitRaw = parseInt(req.query.limit || '50', 10);
    const limit = Math.min(Math.max(limitRaw, 1), 200);

    const search = (req.query.search || '').toString().trim();
    const type = (req.query.type || '').toString().trim().toLowerCase();
    const guildId = (req.query.guildId || '').toString().trim();

    // Se não tiver model (não criaste o ficheiro), usa cache em memória
    if (!DashboardLog) {
      // fallback simples (sem paginação real)
      let filtered = logsCache.slice();

      if (guildId) filtered = filtered.filter(l => l?.guild?.id === guildId);
      if (type) filtered = filtered.filter(l => (l.title || '').toLowerCase().includes(type));

      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(l =>
          (l.title || '').toLowerCase().includes(s) ||
          (l.description || '').toLowerCase().includes(s) ||
          (l.user?.tag || '').toLowerCase().includes(s) ||
          (l.executor?.tag || '').toLowerCase().includes(s)
        );
      }

      filtered.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
      const start = (page - 1) * limit;
      const items = filtered.slice(start, start + limit);

      return res.json({
        ok: true,
        source: 'memory',
        page,
        limit,
        total: filtered.length,
        items
      });
    }

    // mongo query
    const q = {};

    if (guildId) q['guild.id'] = guildId;
    if (type) q.title = { $regex: type, $options: 'i' };

    if (search) {
      q.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'user.tag': { $regex: search, $options: 'i' } },
        { 'executor.tag': { $regex: search, $options: 'i' } }
      ];
    }

    const total = await DashboardLog.countDocuments(q);
    const items = await DashboardLog
      .find(q)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      ok: true,
      source: 'mongo',
      page,
      limit,
      total,
      items
    });
  } catch (err) {
    console.error('[Dashboard] /api/logs error:', err);
    return res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

// * API: GET /api/gamenews-status
app.get('/api/gamenews-status', requireDashboardAuth, async (req, res) => {
  try {
    // se não existir o model, devolve cache em memória
    if (!GameNewsModel) {
      return res.json({
        ok: true,
        source: 'memory',
        items: Array.isArray(gameNewsStatusCache) ? gameNewsStatusCache : []
      });
    }

    const sources = Array.isArray(config?.gameNews?.sources) ? config.gameNews.sources : [];

    // busca docs do Mongo (apenas dos feeds configurados)
    const names = sources.map(s => s?.name).filter(Boolean);
    const docs = await GameNewsModel.find({ source: { $in: names } }).lean();

    const map = new Map();
    for (const d of docs) map.set(d.source, d);

    const items = sources.map((s) => {
      const d = map.get(s.name);
      return {
        source: s.name,
        feedName: s.name,
        feedUrl: s.feed,
        channelId: s.channelId,

        failCount: d?.failCount ?? 0,
        pausedUntil: d?.pausedUntil ?? null,
        lastSentAt: d?.lastSentAt ?? null,
        lastHashesCount: Array.isArray(d?.lastHashes) ? d.lastHashes.length : 0,

        updatedAt: d?.updatedAt ?? null
      };
    });

    return res.json({
      ok: true,
      source: 'mongo',
      items
    });
  } catch (err) {
    console.error('[Dashboard] /api/gamenews-status error:', err);
    return res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

// * se DASHBOARD_TOKEN existir, valida token em socket.handshake.auth.token
io.use((socket, next) => {
  if (!isAuthEnabled()) return next();

  const token = socket.handshake.auth?.token;
  if (token && token === process.env.DASHBOARD_TOKEN) return next();

  return next(new Error('Unauthorized'));
});

// socket.io
io.on('connection', (socket) => {
  console.log('🔌 Dashboard client connected');

  // envia cache de logs em memória
  socket.emit('logs', logsCache);

  // envia cache de status GameNews (se existir)
  socket.emit('gamenews_status', Array.isArray(gameNewsStatusCache) ? gameNewsStatusCache : []);

  socket.on('requestLogs', () => {
    socket.emit('logs', logsCache);
  });

  socket.on('requestGameNewsStatus', () => {
    socket.emit('gamenews_status', Array.isArray(gameNewsStatusCache) ? gameNewsStatusCache : []);
  });

  socket.on('disconnect', () => {
    console.log('❌ Dashboard client disconnected');
  });
});

// * persistência no Mongo + Cache (LOGS)
async function saveLogToMongo(data) {
  if (!DashboardLog) return null;

  try {
    const doc = await DashboardLog.create({
      title: data.title || 'Log',
      user: data.user || null,
      executor: data.executor || null,
      description: data.description || '',
      guild: data.guild || null,
      time: data.time || new Date().toISOString()
    });

    // limpeza automática: manter só os últimos N (opcional)
    const maxDb = config.dashboard?.maxDbLogs ?? 1000;
    if (Number.isFinite(maxDb) && maxDb > 0) {
      const count = await DashboardLog.estimatedDocumentCount();
      if (count > maxDb) {
        const toDelete = count - maxDb;
        const oldest = await DashboardLog
          .find({})
          .sort({ createdAt: 1 })
          .limit(toDelete)
          .select('_id')
          .lean();

        if (oldest.length) {
          await DashboardLog.deleteMany({ _id: { $in: oldest.map(o => o._id) } });
        }
      }
    }

    return doc;
  } catch (err) {
    console.error('[Dashboard] Failed saving log to Mongo:', err?.message || err);
    return null;
  }
}

// * carrega cache inicial do Mongo (últimos X logs)
async function loadInitialCacheFromMongo() {
  if (!DashboardLog) return;

  try {
    const limit = Math.min(Math.max(MAX_MEMORY_LOGS, 10), 500);
    const items = await DashboardLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    logsCache = items.reverse().map((x) => ({
      title: x.title,
      user: x.user,
      executor: x.executor,
      description: x.description,
      guild: x.guild,
      time: x.time || (x.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString())
    }));

    console.log(`[Dashboard] Loaded ${logsCache.length} logs into memory cache`);
  } catch (err) {
    console.error('[Dashboard] Failed loading initial cache:', err);
  }
}

// tenta carregar cache de logs (não bloqueia boot)
loadInitialCacheFromMongo().catch(() => null);

// * função pública: sendToDashboard(event, data)
function sendToDashboard(event, data) {
  if (event === 'log') {
    const payload = {
      ...data,
      time: data?.time ? new Date(data.time).toISOString() : new Date().toISOString()
    };

    // guarda em memória
    logsCache.push(payload);
    if (logsCache.length > MAX_MEMORY_LOGS) logsCache.shift();

    // emite em tempo real
    io.emit('logs', logsCache);

    // persiste no Mongo (async, sem bloquear)
    saveLogToMongo(payload).catch(() => null);

    return;
  }

  // GameNews status (não persiste aqui — já está no Mongo no model GameNews)
  if (event === 'gamenews_status') {
    const arr = Array.isArray(data) ? data : [];
    gameNewsStatusCache = arr;

    // emite para todos os clientes
    io.emit('gamenews_status', gameNewsStatusCache);
    return;
  }
}

module.exports = {
  app,
  server,
  sendToDashboard
};
