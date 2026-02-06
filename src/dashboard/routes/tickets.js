// src/dashboard/routes/tickets.js

module.exports = {
  registerTicketsRoutes
};

function registerTicketsRoutes(opts) {
  const {
    app,
    requireDashboardAuth,
    rateLimit,
    sanitizeText,
    getActorFromRequest,
    recordAudit,
    _getClient,
    _getModels
  } = opts;

  if (!app) throw new Error('registerTicketsRoutes: app is required');

  // -----------------------------
  // List tickets (dashboard)
  // GET /api/tickets?guildId=...&status=open|closed|all&q=...&limit=...
  // -----------------------------
  app.get(
    '/api/tickets',
    requireDashboardAuth,
    rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'rl:tickets:list:' }),
    async (req, res) => {
      try {
        const { TicketModel } = _getModels ? _getModels() : {};
        if (!TicketModel) return res.status(503).json({ ok: false, error: 'Ticket model not available' });

        const guildId = (req.query.guildId || '').toString().trim();
        if (!guildId) return res.status(400).json({ ok: false, error: 'guildId is required' });

        const statusRaw = (req.query.status || 'open').toString().trim().toLowerCase();
        const status = statusRaw === 'all' ? 'all' : (statusRaw === 'closed' ? 'closed' : 'open');
        const q = (req.query.q || '').toString().trim();

        let limit = Number(req.query.limit || 50);
        if (!Number.isFinite(limit) || limit <= 0) limit = 50;
        limit = Math.max(1, Math.min(200, Math.floor(limit)));

        const query = { guildId };
        if (status !== 'all') query.status = status;

        if (q) {
          // Basic search: ticketNumber exact, userId exact, username/subject partial
          const or = [];
          const asNum = Number(q);
          if (Number.isFinite(asNum) && asNum > 0) or.push({ ticketNumber: asNum });
          if (/^\d{10,32}$/.test(q)) or.push({ userId: q });
          const re = new RegExp(escapeRegExp(q), 'i');
          or.push({ username: re });
          or.push({ subject: re });
          query.$or = or;
        }

        const items = await TicketModel.find(query)
          .sort({ status: 1, createdAt: -1 })
          .limit(limit)
          .lean();

        return res.json({ ok: true, items });
      } catch (err) {
        console.error('[Dashboard] GET /api/tickets error:', err);
        return res.status(500).json({ ok: false, error: 'Internal Server Error' });
      }
    }
  );

  // -----------------------------
  // Close/reopen ticket
  // -----------------------------
  app.post(
    '/api/tickets/:ticketId/close',
    requireDashboardAuth,
    rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'rl:tickets:close:' }),
    async (req, res) => {
      try {
        const { TicketModel } = _getModels ? _getModels() : {};
        if (!TicketModel) return res.status(503).json({ ok: false, error: 'Ticket model not available' });

        const ticketId = (req.params.ticketId || '').toString().trim();
        if (!ticketId) return res.status(400).json({ ok: false, error: 'ticketId is required' });

        const ticket = await TicketModel.findById(ticketId).lean();
        if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket not found' });

        const guildId = (req.body?.guildId || ticket.guildId || '').toString().trim();
        if (!guildId) return res.status(400).json({ ok: false, error: 'guildId is required' });

        const actor = (getActorFromRequest && getActorFromRequest(req)) || 'dashboard';

        // Update DB
        await TicketModel.updateOne(
          { _id: ticketId },
          {
            $set: {
              status: 'closed',
              closedAt: new Date(),
              closedById: actor,
              closedByUsername: actor
            }
          }
        );

        // Try to archive/lock thread
        const client = _getClient ? _getClient() : null;
        if (client) {
          const guild = client.guilds.cache.get(guildId);
          const channelId = ticket.channelId;
          const ch = guild?.channels?.cache?.get(channelId);
          if (ch && typeof ch.setArchived === 'function') {
            try {
              await ch.setLocked(true, 'Closed via dashboard');
            } catch (e) {}
            try {
              await ch.setArchived(true, 'Closed via dashboard');
            } catch (e) {}
          }
        }

        if (recordAudit) {
          await recordAudit({
            req,
            action: 'ticket.close',
            guildId,
            targetUserId: ticket.userId,
            actor,
            payload: { ticketId }
          });
        }

        return res.json({ ok: true });
      } catch (err) {
        console.error('[Dashboard] POST /api/tickets/:ticketId/close error:', err);
        return res.status(500).json({ ok: false, error: 'Internal Server Error' });
      }
    }
  );

  app.post(
    '/api/tickets/:ticketId/reopen',
    requireDashboardAuth,
    rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'rl:tickets:reopen:' }),
    async (req, res) => {
      try {
        const { TicketModel } = _getModels ? _getModels() : {};
        if (!TicketModel) return res.status(503).json({ ok: false, error: 'Ticket model not available' });

        const ticketId = (req.params.ticketId || '').toString().trim();
        if (!ticketId) return res.status(400).json({ ok: false, error: 'ticketId is required' });

        const ticket = await TicketModel.findById(ticketId).lean();
        if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket not found' });

        const guildId = (req.body?.guildId || ticket.guildId || '').toString().trim();
        if (!guildId) return res.status(400).json({ ok: false, error: 'guildId is required' });

        const actor = (getActorFromRequest && getActorFromRequest(req)) || 'dashboard';

        await TicketModel.updateOne(
          { _id: ticketId },
          {
            $set: {
              status: 'open',
              closedAt: null,
              closedById: null,
              closedByUsername: null
            }
          }
        );

        const client = _getClient ? _getClient() : null;
        if (client) {
          const guild = client.guilds.cache.get(guildId);
          const channelId = ticket.channelId;
          const ch = guild?.channels?.cache?.get(channelId);
          if (ch && typeof ch.setArchived === 'function') {
            try {
              await ch.setArchived(false, 'Reopened via dashboard');
            } catch (e) {}
            try {
              await ch.setLocked(false, 'Reopened via dashboard');
            } catch (e) {}
          }
        }

        if (recordAudit) {
          await recordAudit({
            req,
            action: 'ticket.reopen',
            guildId,
            targetUserId: ticket.userId,
            actor,
            payload: { ticketId }
          });
        }

        return res.json({ ok: true });
      } catch (err) {
        console.error('[Dashboard] POST /api/tickets/:ticketId/reopen error:', err);
        return res.status(500).json({ ok: false, error: 'Internal Server Error' });
      }
    }
  );

  // Reply to a ticket from the dashboard
  app.post(
    '/api/tickets/:ticketId/reply',
    requireDashboardAuth,
    rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'rl:tickets:reply:' }),
    async (req, res) => {
      try {
        const { TicketModel } = _getModels ? _getModels() : {};
        if (!TicketModel) {
          return res.status(503).json({ ok: false, error: 'Ticket model not available' });
        }

        const ticketId = (req.params.ticketId || '').toString().trim();
        const rawGuildId = (req.body?.guildId || '').toString().trim();
        const content = sanitizeText ? sanitizeText(req.body?.content || '', { maxLen: 2000, stripHtml: true }) : (req.body?.content || '').toString().slice(0, 2000);

        if (!ticketId) {
          return res.status(400).json({ ok: false, error: 'ticketId is required' });
        }
        if (!content) {
          return res.status(400).json({ ok: false, error: 'content is required' });
        }

        const ticket = await TicketModel.findById(ticketId).lean();
        if (!ticket) {
          return res.status(404).json({ ok: false, error: 'Ticket not found' });
        }

        const guildId = rawGuildId || (ticket.guildId || '');
        if (!guildId) {
          return res.status(400).json({ ok: false, error: 'guildId is required' });
        }

        const client = _getClient ? _getClient() : null;
        if (!client) {
          return res.status(503).json({ ok: false, error: 'Client not available' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          return res.status(404).json({ ok: false, error: 'Guild not found' });
        }

        const channelId = ticket.channelId;
        if (!channelId) {
          return res.status(404).json({ ok: false, error: 'Ticket channel not found' });
        }

        const channel = guild.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased?.()) {
          return res.status(404).json({ ok: false, error: 'Ticket channel not found or not text-based' });
        }

        const actor = (getActorFromRequest && getActorFromRequest(req)) || 'dashboard';
        const prefix = '[Dashboard reply]';

        await channel.send(`${prefix} ${content}`);

        try {
          await TicketModel.updateOne(
            { _id: ticketId },
            {
              $set: {
                lastMessageAt: new Date(),
                lastResponderId: actor,
                lastResponderName: actor,
                lastResponderAt: new Date()
              }
            }
          );
        } catch (e) {
          console.warn('[Dashboard] Failed to update ticket lastMessageAt:', e?.message || e);
        }

        if (recordAudit) {
          await recordAudit({
            req,
            action: 'ticket.reply',
            guildId,
            targetUserId: ticket.userId,
            actor,
            payload: { ticketId }
          });
        }

        return res.json({ ok: true });
      } catch (err) {
        console.error('[Dashboard] /api/tickets/:ticketId/reply error:', err);
        return res.status(500).json({ ok: false, error: 'Internal Server Error' });
      }
    }
  );
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
