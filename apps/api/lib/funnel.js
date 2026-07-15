/**
 * Funnel event tracking — logs try-on → view → purchase events to the
 * funnel_events table so we can measure conversion and cost/revenue per
 * try-on.
 *
 * Costs are estimated from provider pricing:
 *   Replicate IDM-VTON: ~$0.024/render
 *   Venice SD35:        ~$0.015/render
 *   Venice qwen3-vl:    ~$0.004/analysis
 *   Gemini flash-lite:  ~$0.0002/text
 */

const PROVIDER_COSTS = {
  'replicate-idm-vton': '0.024',
  'venice-image': '0.015',
  'venice-vision': '0.004',
  'gemini-text': '0.0002',
  'cache': '0.000',
};

// Lazy DB connection — shared across all funnel logging
let _db = null;
function getDb() {
  if (_db) return _db;
  try {
    const { neon } = require('@neondatabase/serverless');
    const { drizzle } = require('drizzle-orm/neon-http');
    const connStr = process.env.NEON_DATABASE_URL;
    if (!connStr) return null;
    const sql = neon(connStr);
    _db = drizzle(sql);
    return _db;
  } catch {
    return null;
  }
}

/**
 * Log a funnel event. Non-blocking — errors are swallowed so tracking
 * never breaks the user flow.
 *
 * @param {object|null} db - Drizzle DB instance (if null, creates one lazily)
 * @param {object} event - Event details
 * @param {string} event.eventType - tryon_start | tryon_complete | tryon_share | listing_view | purchase
 * @param {string} event.source - web | agent
 * @param {string} [event.tier] - free | paid
 * @param {string} [event.curatorSlug]
 * @param {string} [event.listingId]
 * @param {string} [event.sessionId]
 * @param {string} [event.visitorHash]
 * @param {string} [event.payerAddress]
 * @param {string} [event.provider] - provider used (for cost lookup)
 * @param {string} [event.revenueUsd]
 * @param {object} [event.metadata]
 * @param {string} [event.clientIp]
 */
async function logFunnelEvent(db, event) {
  try {
    const database = db || getDb();
    if (!database) return;
    const { funnelEvents } = require('@repo/db');
    const costUsd = event.provider ? PROVIDER_COSTS[event.provider] : null;
    await database.insert(funnelEvents).values({
      eventType: event.eventType,
      source: event.source,
      tier: event.tier || null,
      curatorSlug: event.curatorSlug || null,
      listingId: event.listingId || null,
      sessionId: event.sessionId || null,
      visitorHash: event.visitorHash || null,
      payerAddress: event.payerAddress || null,
      costUsd,
      revenueUsd: event.revenueUsd || null,
      metadata: event.metadata || {},
      clientIp: event.clientIp || null,
    });
  } catch (err) {
    // Tracking is best-effort — never break the flow
    console.error('[funnel] Failed to log event:', err.message);
  }
}

module.exports = { logFunnelEvent, PROVIDER_COSTS };
