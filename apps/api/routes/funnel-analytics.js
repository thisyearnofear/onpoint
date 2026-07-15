/**
 * Funnel Analytics Route — /api/status/funnel
 *
 * Returns try-on → purchase conversion metrics from the funnel_events table.
 * Helps answer: are try-ons worth the cost? What's the conversion rate?
 *
 * Auth: SERVICE_API_KEY (internal analytics)
 */

const express = require('express');
const router = express.Router();
const { neon } = require('@neondatabase/serverless');
const logger = require('../lib/logger');

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;
let _sql = null;
function getSql() {
  if (!_sql && CONNECTION_STRING) _sql = neon(CONNECTION_STRING);
  return _sql;
}

// GET /api/status/funnel?days=7
router.get('/', async (req, res) => {
  try {
    const sql = getSql();
    if (!sql) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const days = Math.min(parseInt(req.query.days) || 7, 90);

    // Overall funnel summary
    const summary = await sql`
      SELECT
        event_type,
        tier,
        source,
        COUNT(*) as count,
        COALESCE(SUM(cost_usd::numeric), 0) as total_cost_usd,
        COALESCE(SUM(revenue_usd::numeric), 0) as total_revenue_usd
      FROM funnel_events
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY event_type, tier, source
      ORDER BY event_type, tier, source
    `;

    // Conversion: try-ons that led to purchases (by listing_id)
    const conversion = await sql`
      WITH tryons AS (
        SELECT DISTINCT listing_id, curator_slug, payer_address, session_id
        FROM funnel_events
        WHERE event_type = 'tryon_complete'
          AND created_at > NOW() - INTERVAL '${days} days'
      ),
      purchases AS (
        SELECT DISTINCT listing_id, curator_slug, payer_address
        FROM funnel_events
        WHERE event_type = 'purchase'
          AND created_at > NOW() - INTERVAL '${days + 7} days'
      )
      SELECT
        COUNT(DISTINCT t.listing_id || COALESCE(t.payer_address, t.session_id, '')) as total_tryons,
        COUNT(DISTINCT CASE WHEN p.listing_id IS NOT NULL THEN t.listing_id || COALESCE(t.payer_address, t.session_id, '') END) as converted_tryons
      FROM tryons t
      LEFT JOIN purchases p ON t.listing_id = p.listing_id
        AND (t.payer_address IS NOT NULL AND t.payer_address = p.payer_address)
    `;

    // Cost vs revenue per day
    const timeseries = await sql`
      SELECT
        DATE(created_at) as date,
        event_type,
        COUNT(*) as count,
        COALESCE(SUM(cost_usd::numeric), 0) as cost_usd,
        COALESCE(SUM(revenue_usd::numeric), 0) as revenue_usd
      FROM funnel_events
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at), event_type
      ORDER BY date DESC, event_type
    `;

    // Top curators by try-on activity
    const topCurators = await sql`
      SELECT
        curator_slug,
        COUNT(*) FILTER (WHERE event_type = 'tryon_complete') as tryons,
        COUNT(*) FILTER (WHERE event_type = 'purchase') as purchases,
        COALESCE(SUM(cost_usd::numeric) FILTER (WHERE event_type = 'tryon_complete'), 0) as tryon_cost,
        COALESCE(SUM(revenue_usd::numeric) FILTER (WHERE event_type = 'purchase'), 0) as purchase_revenue
      FROM funnel_events
      WHERE created_at > NOW() - INTERVAL '${days} days'
        AND curator_slug IS NOT NULL
      GROUP BY curator_slug
      ORDER BY tryons DESC
      LIMIT 20
    `;

    const totalTryons = parseInt(conversion[0]?.total_tryons || '0');
    const convertedTryons = parseInt(conversion[0]?.converted_tryons || '0');
    const conversionRate = totalTryons > 0 ? (convertedTryons / totalTryons * 100).toFixed(2) : '0.00';

    res.json({
      period: { days },
      summary: summary.map((r) => ({
        eventType: r.event_type,
        tier: r.tier,
        source: r.source,
        count: parseInt(r.count),
        costUsd: r.total_cost_usd?.toString() || '0',
        revenueUsd: r.total_revenue_usd?.toString() || '0',
      })),
      conversion: {
        totalTryons,
        convertedTryons,
        conversionRate: `${conversionRate}%`,
      },
      timeseries: timeseries.map((r) => ({
        date: r.date,
        eventType: r.event_type,
        count: parseInt(r.count),
        costUsd: r.cost_usd?.toString() || '0',
        revenueUsd: r.revenue_usd?.toString() || '0',
      })),
      topCurators: topCurators.map((r) => ({
        curatorSlug: r.curator_slug,
        tryons: parseInt(r.tryons || '0'),
        purchases: parseInt(r.purchases || '0'),
        tryonCost: r.tryon_cost?.toString() || '0',
        purchaseRevenue: r.purchase_revenue?.toString() || '0',
      })),
    });
  } catch (error) {
    logger.error('Funnel analytics failed', { component: 'funnel-analytics' }, error);
    res.status(500).json({ error: 'Failed to fetch funnel analytics' });
  }
});

module.exports = router;
