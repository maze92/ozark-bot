// Mod actions (Dashboard -> Bot)
// ==============================

async function resolveGuildMember(guildId, userId) {
  if (!_client) return { guild: null, member: null };
  const guild = _client.guilds.cache.get(guildId) || null;
  if (!guild) return { guild: null, member: null };
  const member = await guild.members.fetch(userId).catch(() => null);
  return { guild, member };
}

app.post('/api/mod/warn', requireDashboardAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const parseResult = ModWarnSchema.safeParse(body);
    if (!parseResult.success) {
      return res.status(400).json({ ok: false, error: 'Invalid warn payload' });
    }
    const { guildId: g0, userId: u0, reason: r0 } = parseResult.data;
    const guildId = sanitizeId(g0);
    const userId = sanitizeId(u0);
    const reason = sanitizeText(r0, { maxLen: 1000, stripHtml: true });
    const actor = getActorFromRequest(req);

    await recordAudit({
      req,
      action: 'mod.warn',
      guildId,
      targetUserId: userId,
      actor,
      payload: { reason }
    });

    if (!guildId || !userId) {
      return res.status(400).json({ ok: false, error: 'guildId and userId are required' });
    }

    if (!_client) {
      return res.status(500).json({ ok: false, error: 'Client not ready' });
    }

    const result = await dashboardWarn({
      client: _client,
      guildId,
      userId,
      reason,
      actor
    });

    const dbUser = result && result.dbUser ? result.dbUser : null;

    return res.json({
      ok: true,
      dbUser: dbUser ? { warnings: dbUser.warnings, trust: dbUser.trust } : null
    });
  } catch (err) {
    console.error('[Dashboard] /api/mod/warn error:', err);

    if (err && err.code) {
      if (err.code === 'USER_NOT_FOUND_IN_GUILD') {
        return res.status(404).json({ ok: false, error: 'User not found in guild' });
      }
      if (err.code === 'BOT_MEMBER_NOT_AVAILABLE') {
        return res.status(500).json({ ok: false, error: 'Bot member not available' });
      }
      if (err.code === 'CANNOT_WARN_BOT') {
        return res.status(400).json({ ok: false, error: 'Cannot warn the bot' });
      }
      if (err.code === 'TARGET_ROLE_HIGHER_OR_EQUAL') {
        return res.status(400).json({ ok: false, error: 'Target role is higher or equal to bot' });
      }
      if (err.code === 'CANNOT_WARN_ADMINS') {
        return res.status(400).json({ ok: false, error: 'Cannot warn administrators via dashboard' });
      }
      if (err.code === 'CLIENT_NOT_READY') {
        return res.status(500).json({ ok: false, error: 'Client not ready' });
      }
    }

    return res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});
app.post('/api/mod/mute', requireDashboardAuth, rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'rl:mod:mute:' }), async (req, res) => {
  try {
    const body = req.body || {};
    const parseResult = ModMuteSchema.safeParse(body);
    if (!parseResult.success) {
      return res.status(400).json({ ok: false, error: 'Invalid mute payload' });
    }
    const { guildId: g0, userId: u0, duration: d0, reason: r0 } = parseResult.data;
    const guildId = sanitizeId(g0);
    const userId = sanitizeId(u0);
    const duration = sanitizeText(d0, { maxLen: 32, stripHtml: true });
    const reason = sanitizeText(r0, { maxLen: 1000, stripHtml: true });
    const actor = getActorFromRequest(req);
    await recordAudit({
      req,
      action: 'mod.mute',
      guildId,
      targetUserId: userId,
      actor,
      payload: { reason }
    });
    if (!guildId || !userId) {
      return res.status(400).json({ ok: false, error: 'guildId and userId are required' });
    }

    if (!_client) {
      return res.status(500).json({ ok: false, error: 'Client not ready' });
    }

    const r = reason || 'Dashboard mute';
    const parsed = parseDuration(duration);
    const durationMs = parsed || config.muteDuration || 10 * 60 * 1000;

    const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;
    if (durationMs > MAX_TIMEOUT_MS) {
      return res.status(400).json({ ok: false, error: 'Duration too long (max 28d).' });
    }

    const { guild, member } = await resolveGuildMember(guildId, userId);
    if (!guild || !member) {
      return res.status(404).json({ ok: false, error: 'User not found in guild' });
    }

    const me = guild.members.me;
    if (!me) {
      return res.status(500).json({ ok: false, error: 'Bot member not available' });
    }

    if (member.id === me.id) {
      return res.status(400).json({ ok: false, error: 'Cannot mute the bot' });
    }

    if (member.roles.highest.position >= me.roles.highest.position) {
      return res.status(400).json({ ok: false, error: 'Target role is higher or equal to bot' });
    }

    if (!member.moderatable) {
      return res.status(400).json({ ok: false, error: 'Member is not moderatable by the bot' });
    }

    await member.timeout(durationMs, `Muted by dashboard: ${r}`).catch((e) => {
      throw new Error(e?.message || 'Failed to timeout');
    });

    const dbUser = await warningsService.applyMutePenalty(guild.id, member.id).catch(() => null);

    const trustCfg = getTrustConfig();
    const trust = dbUser?.trust;
    const trustText = (trustCfg.enabled && trust != null)
      ? `Trust: **${trust}/${trustCfg.max}**`
      : (trust != null ? `Trust: **${trust}**` : '');

    await infractionsService.create({
      guild,
      user: member.user,
      moderator: _client.user,
      type: 'MUTE',
      reason: actor ? `${r} (dashboard: ${actor})` : r,
      duration: durationMs,
      source: 'dashboard'
    }).catch(() => null);

    const trustTextLog = trustText ? `\n${trustText}` : '';
    await logger(
      _client,
      'Dashboard Mute',
      member.user,
      _client.user,
      `Duration: **${formatDuration(durationMs)}**\nReason: **${r}**${trustTextLog}` + (actor ? `\nExecutor (dashboard): **${actor}**` : ''),
      guild
    );

    return res.json({ ok: true, durationMs, durationLabel: formatDuration(durationMs) });
  } catch (err) {
    console.error('[Dashboard] /api/mod/mute error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal Server Error' });
  }
});

app.post('/api/mod/unmute', requireDashboardAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const parseResult = ModWarnSchema.safeParse(body);
    if (!parseResult.success) {
      return res.status(400).json({ ok: false, error: 'Invalid warn payload' });
    }
    const { guildId: g0, userId: u0, reason: r0 } = parseResult.data;
    const guildId = sanitizeId(g0);
    const userId = sanitizeId(u0);
    const reason = sanitizeText(r0, { maxLen: 1000, stripHtml: true });
    const actor = getActorFromRequest(req);
    await recordAudit({
      req,
      action: 'mod.unmute',
      guildId,
      targetUserId: userId,
      actor,
      payload: { reason }
    });
    if (!guildId || !userId) {
      return res.status(400).json({ ok: false, error: 'guildId and userId are required' });
    }

    if (!_client) {
      return res.status(500).json({ ok: false, error: 'Client not ready' });
    }

    const r = reason || 'Dashboard unmute';

    const { guild, member } = await resolveGuildMember(guildId, userId);
    if (!guild || !member) {
      return res.status(404).json({ ok: false, error: 'User not found in guild' });
    }

    const me = guild.members.me;
    if (!me) {
      return res.status(500).json({ ok: false, error: 'Bot member not available' });
    }

    if (member.roles.highest.position >= me.roles.highest.position) {
      return res.status(400).json({ ok: false, error: 'Target role is higher or equal to bot' });
    }

    await member.timeout(null, `Unmuted by dashboard: ${r}`).catch((e) => {
      throw new Error(e?.message || 'Failed to remove timeout');
    });

    await logger(
      _client,
      'Dashboard Unmute',
      member.user,
      _client.user,
      `Reason: **${r}**` + (actor ? `\nExecutor (dashboard): **${actor}**` : ''),
      guild
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Dashboard] /api/mod/unmute error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal Server Error' });
  }
});



app.post('/api/mod/reset-trust', requireDashboardAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const parseResult = ModWarnSchema.safeParse(body);
    if (!parseResult.success) {
      return res.status(400).json({ ok: false, error: 'Invalid warn payload' });
    }
    const { guildId: g0, userId: u0, reason: r0 } = parseResult.data;
    const guildId = sanitizeId(g0);
    const userId = sanitizeId(u0);
    const reason = sanitizeText(r0, { maxLen: 1000, stripHtml: true });
    const actor = getActorFromRequest(req);

    await recordAudit({
      req,
      action: 'mod.resetTrust',
      guildId,
      targetUserId: userId,
      actor,
      payload: { reason }
    });

    if (!guildId || !userId) {
      return res.status(400).json({ ok: false, error: 'guildId and userId are required' });
    }

    const { guild, member } = await resolveGuildMember(guildId, userId);
    if (!guild || !member) {
      return res.status(404).json({ ok: false, error: 'User not found in guild' });
    }

    const me = guild.members.me;
    if (!me) {
      return res.status(500).json({ ok: false, error: 'Bot member not available' });
    }

    // Não deixar resetar alguém com cargo superior ao bot
    if (member.roles.highest && me.roles.highest && member.roles.highest.comparePositionTo(me.roles.highest) >= 0) {
      return res.status(403).json({ ok: false, error: 'User has higher or equal role' });
    }

    const baseReason = reason || 'Dashboard reset trust/warnings';

    // Reset via warningsService (avisos + trust)
    const warningsService = require('./systems/warningsService');
    const trustCfg = require('./utils/trust').getTrustConfig();

    const baseTrust = typeof trustCfg.base === 'number' ? trustCfg.base : 0;

    const dbUser = await warningsService
      .resetUser(guild.id, member.id, baseTrust, baseReason)
      .catch(() => null);

    // Limpar auto-mute/timeout ativo, se existir
    try {
      const hasTimeoutFlag =
        typeof member.isCommunicationDisabled === 'function'
          ? member.isCommunicationDisabled()
          : !!member.communicationDisabledUntilTimestamp;

      if (hasTimeoutFlag && typeof member.timeout === 'function') {
        await member.timeout(null, baseReason).catch(() => null);
      }
    } catch (e) {
      console.warn('[Dashboard] reset-trust: failed to clear timeout', e);
    }

    // Limpar histórico de infrações (WARN/MUTE) deste utilizador no servidor
    if (Infraction) {
      try {
        await Infraction.deleteMany({ guildId: guild.id, userId: member.id }).exec();
      } catch (e) {
        console.warn('[Dashboard] reset-trust: failed to delete infractions', e);
      }
    }

    return res.json({
      ok: true,
      dbUser: dbUser ? { warnings: dbUser.warnings, trust: dbUser.trust } : null
    });
  } catch (err) {
    console.error('[Dashboard] /api/mod/reset-trust error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal Server Error' });
  }
});



app.post('/api/mod/remove-infraction', requireDashboardAuth, async (req, res) => {
  try {
    const { guildId: g0, userId: u0, infractionId: id0 } = req.body || {};
    const guildId = sanitizeId(g0);
    const userId = sanitizeId(u0);
    const infractionId = typeof id0 === 'string' || typeof id0 === 'number' ? String(id0) : null;
    const actor = getActorFromRequest(req);

    await recordAudit({
      req,
      action: 'mod.removeInfraction',
      guildId,
      targetUserId: userId,
      actor,
      payload: { infractionId }
    });

    if (!guildId || !userId || !infractionId) {
      return res.status(400).json({ ok: false, error: 'Missing guildId, userId or infractionId' });
    }

    if (!Infraction) {
      return res.status(500).json({ ok: false, error: 'Infraction model not available' });
    }

    // Tentar encontrar a infração de forma robusta (ObjectId, string legacy ou caseId)
    const rawCollection = Infraction && Infraction.collection;
    if (!rawCollection) {
      return res.status(500).json({ ok: false, error: 'Infractions collection not available' });
    }

    const orFilters = [];

    if (infractionId) {
      // Caso 1: parecer um ObjectId (24 hex)
      if (typeof infractionId === 'string' && /^[0-9a-fA-F]{24}$/.test(infractionId)) {
        try {
          orFilters.push({
            _id: new mongoose.Types.ObjectId(infractionId),
            guildId,
            userId
          });
        } catch (e) {
          // ignore cast error here
        }
      }

      // Caso 2: usar o valor bruto como _id (string/legacy)
      orFilters.push({
        _id: infractionId,
        guildId,
        userId
      });

      // Caso 3: tentar como caseId numérico
      const asNumber = Number(infractionId);
      if (Number.isFinite(asNumber)) {
        orFilters.push({
          caseId: asNumber,
          guildId,
          userId
        });
      }
    }

    const query = orFilters.length ? { $or: orFilters } : { guildId, userId };

    const inf = await rawCollection.findOne(query);
    if (!inf) {
      return res.status(404).json({ ok: false, error: 'Infraction not found' });
    }

    let guild = null;
    let member = null;
    try {
      const resolved = await resolveGuildMember(guildId, userId);
      guild = resolved.guild;
      member = resolved.member;
    } catch (e) {
      console.warn('[Dashboard] remove-infraction: failed to resolve member from Discord', e);
    }

    if (guild && member && guild.members && guild.members.me) {
      const me = guild.members.me;
      // Não deixar remover infração de alguém com cargo superior ao bot
      if (member.roles && member.roles.highest && me.roles && me.roles.highest &&
          member.roles.highest.comparePositionTo(me.roles.highest) >= 0) {
        return res.status(403).json({ ok: false, error: 'User has higher or equal role' });
      }
    }

    let warningsService = null;
    try {
      warningsService = require('./systems/warningsService');
    } catch (_) {}

    if (warningsService && typeof warningsService.removeInfractionEffects === 'function') {
      try {
        if (guild && member) {
          await warningsService.removeInfractionEffects(guild.id, member.id, inf.type || '');
        } else {
          await warningsService.removeInfractionEffects(guildId, userId, inf.type || '');
        }
      } catch (e) {
        console.warn('[Dashboard] remove-infraction: failed to adjust trust/warnings', e);
      }
    }

    // Remover definitivamente o documento, usando a mesma estratégia de filtro
    await rawCollection.deleteOne({ _id: inf._id, guildId, userId });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Dashboard] /api/mod/remove-infraction error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal Server Error' });
  }
});


app.get('/api/mod/overview', requireDashboardAuth, async (req, res) => {
  try {
    const guildId = (req.query.guildId || '').toString().trim();
    if (!guildId) {
      return res.status(400).json({ ok: false, error: 'Missing guildId' });
    }

    const range = (req.query.range || '24h').toString();
    let windowHours = 24;
    if (range === '7d') {
      windowHours = 24 * 7;
    } else if (range === '30d') {
      windowHours = 24 * 30;
    } else if (range === '1y') {
      windowHours = 24 * 365;
    }

    const now = new Date();
    const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

    const result = {
      ok: true,
      guildId,
      windowHours,
      moderationCounts: {
        warn: 0,
        mute: 0,
        unmute: 0,
        kick: 0,
        ban: 0,
        other: 0
      },
      tickets: {
        total: 0,
        open: 0,
        closed: 0
      }
    };

    // Contagens de moderação (DashboardLog ou cache em memória)
    try {
      if (DashboardLog) {
        const q = {
          'guild.id': guildId,
          createdAt: { $gte: since }
        };

        const docs = await DashboardLog
          .find(q, { title: 1, createdAt: 1 })
          .lean();

        for (const doc of docs) {
          const title = (doc.title || '').toString().toLowerCase();

          if (title.includes('warn')) {
            result.moderationCounts.warn++;
          } else if (title.includes('mute')) {
            // distinguir unmute por palavra
            if (title.includes('unmute')) {
              result.moderationCounts.unmute++;
            } else {
              result.moderationCounts.mute++;
            }
          } else if (title.includes('unmute')) {
            result.moderationCounts.unmute++;
          } else if (title.includes('kick')) {
            result.moderationCounts.kick++;
          } else if (title.includes('ban')) {
            result.moderationCounts.ban++;
          } else {
            result.moderationCounts.other++;
          }
        }
      } else {
        // Fallback: logsCache (em memória)
        const sinceMs = since.getTime();
        const filtered = logsCache.filter((log) => {
          if (!log) return false;
          if (guildId && log.guild && log.guild.id !== guildId) return false;
          if (!log.time) return false;
          const ts = Date.parse(log.time);
          if (Number.isNaN(ts)) return false;
          return ts >= sinceMs;
        });

        for (const log of filtered) {
          const title = (log.title || '').toString().toLowerCase();

          if (title.includes('warn')) {
            result.moderationCounts.warn++;
          } else if (title.includes('mute')) {
            if (title.includes('unmute')) {
              result.moderationCounts.unmute++;
            } else {
              result.moderationCounts.mute++;
            }
          } else if (title.includes('unmute')) {
            result.moderationCounts.unmute++;
          } else if (title.includes('kick')) {
            result.moderationCounts.kick++;
          } else if (title.includes('ban')) {
            result.moderationCounts.ban++;
          } else {
            result.moderationCounts.other++;
          }
        }
      }
    } catch (err) {
      console.error('[Dashboard] /api/mod/overview logs error:', err);
    }

    // Contagens de tickets (TicketLog, se disponível)
    try {
      if (TicketLog) {
        const tq = {
          guildId,
          createdAt: { $gte: since }
        };

        const tickets = await TicketLog
          .find(tq, { createdAt: 1, closedAt: 1 })
          .lean();

        result.tickets.total = tickets.length;
        for (const t of tickets) {
          if (t.closedAt) {
            result.tickets.closed++;
          } else {
            result.tickets.open++;
          }
        }
      }
    } catch (err) {
      console.error('[Dashboard] /api/mod/overview tickets error:', err);
    }

    return res.json(result);
  } catch (err) {
    console.error('[Dashboard] /api/mod/overview error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal Server Error' });
  }
});

