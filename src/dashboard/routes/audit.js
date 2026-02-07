// src/dashboard/routes/audit.js

function registerAuditRoutes({
  app,
  requireDashboardAuth,
  DashboardAudit
}) {
  app.get('/api/audit/config', requireDashboardAuth, async (req, res) => {
    try {
      if (!DashboardAudit) {
        return res.json({ ok: true, items: [] });
      }

      const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
      const guildId = (req.query.guildId || '').toString().trim();

      const query = {
        action: {
          $in: ['config.patch', 'guildConfig.update', 'logs.clear', 'cases.clear', 'tickets.clear']
        }
      };
      if (guildId) query.guildId = guildId;

      const items = await DashboardAudit.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      return res.json({ ok: true, items });
    } catch (err) {
      console.error('[Dashboard] /api/audit/config error:', err);
      return res.status(500).json({ ok: false, error: 'Internal Server Error' });
    }
  });
}

module.exports = { registerAuditRoutes };
