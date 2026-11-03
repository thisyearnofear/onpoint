/**
 * Runway Metrics Route — GET /api/runway/metrics?days=14
 *
 * Retention/engagement metrics over web-surface runway funnel events
 * (ops/retention.md). Auth: SERVICE_API_KEY via serviceKeyAuth at mount.
 */

const express = require('express');
const { getDb } = require('../lib/db');
const { and, eq, gte } = require('drizzle-orm');
const { funnelEvents } = require('@repo/db');
const { computeRunwayMetrics } = require('../lib/runway/metrics');
const logger = require('../lib/logger');

const router = express.Router();
const MAX_ROWS = 50000;

router.get('/', async (req, res) => {
  try {
    const db = getDb({ funnelEvents });
    if (!db) return res.status(500).json({ error: 'Database not configured' });
    const days = Math.max(1, Math.min(parseInt(req.query.days, 10) || 14, 60));
    const now = Date.now();
    const since = new Date(now - days * 86400000);
    const rows = await db
      .select({ eventType: funnelEvents.eventType, createdAt: funnelEvents.createdAt, metadata: funnelEvents.metadata })
      .from(funnelEvents)
      .where(and(eq(funnelEvents.source, 'runway'), gte(funnelEvents.createdAt, since)))
      .limit(MAX_ROWS);
    const events = rows.filter((r) => r.metadata?.surface === 'web');
    return res.json(computeRunwayMetrics(events, { now, days }));
  } catch (err) {
    logger.error('runway metrics failed', { component: 'runway-metrics', error: err.message });
    return res.status(500).json({ error: 'Could not compute runway metrics' });
  }
});

module.exports = router;
