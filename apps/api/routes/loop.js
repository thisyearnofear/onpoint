/**
 * Loop Routes — /api/loop
 *
 * Viral loop instrumentation + recipient capture:
 *   POST /api/loop/event    { type, meta }   → funnel event on loop hops
 *   POST /api/loop/capture  { channel, contact, source, ref } → opt-in
 *   GET  /api/loop/cards?limit= → recent public couple cards (the feed)
 */

const express = require('express');
const { desc, eq } = require('drizzle-orm');
const { loopCaptures, coupleCards } = require('@repo/db');
const { getDb } = require('../lib/db');
const { logFunnelEvent } = require('../lib/funnel');
const { sendMessage } = require('../lib/linq-client');
const { sanitizeShareId, sanitizeChannel, sanitizeLookSlug, hashVisitor } = require('../lib/share-attribution');
const logger = require('../lib/logger');

const router = express.Router();

const EVENT_TYPES = new Set([
  'invite_opened', 'invite_rendered',
  'couple_card_created', 'couple_card_viewed',
  'gift_opened', 'gift_claimed', 'card_feed_viewed',
  'artifact_shared', 'artifact_visit',
  // Retention-loop events (loop-cohesion plan P2.2) — measurable beside
  // acquisition in the funnel report.
  'closet_add', 'closet_plan',
]);

/**
 * Artifact shares (polaroids, couple cards, gifts) mint a client-side sid but
 * are not looks — without a look_share/look_visit funnel row the share funnel
 * drops every downstream join for that sid (see summarizeShareFunnel). When a
 * shareId rides along we mirror the hop into the look_* event types so the
 * artifact joins the same spine. `lookSlug` stays null for bare artifacts;
 * artifact pages may set meta.lookSlug to a synthetic `p-<id>` key.
 */
async function mirrorArtifactShare(db, req, meta) {
  const shareId = sanitizeShareId(meta && meta.shareId);
  if (!shareId) return;
  const channel = sanitizeChannel(meta && meta.channel);
  const lookSlug = sanitizeLookSlug(meta && meta.lookSlug) || null;
  const artifact = typeof meta.path === 'string' ? meta.path.slice(0, 200) : null;
  const visitorHash = hashVisitor(req.ip, req.headers['user-agent']);
  await logFunnelEvent(db, {
    eventType: 'look_share',
    source: 'web',
    visitorHash,
    clientIp: req.ip,
    metadata: { shareId, channel, lookSlug, artifact },
  });
}

async function mirrorArtifactVisit(db, req, meta) {
  const shareId = sanitizeShareId(meta && meta.shareId);
  if (!shareId) return;
  const channel = sanitizeChannel(meta && meta.channel);
  const lookSlug = sanitizeLookSlug(meta && meta.lookSlug) || null;
  const visitorHash = hashVisitor(req.ip, req.headers['user-agent']);
  await logFunnelEvent(db, {
    eventType: 'look_visit',
    source: 'web',
    visitorHash,
    clientIp: req.ip,
    metadata: { shareId, channel, lookSlug },
  });
}

router.post('/event', async (req, res) => {
  try {
    const { type, meta } = req.body || {};
    if (!type || !EVENT_TYPES.has(String(type))) {
      return res.status(400).json({ error: 'unknown event type' });
    }
    const db = getDb();
    await logFunnelEvent(db, {
      eventType: String(type),
      source: 'web',
      metadata: meta && typeof meta === 'object' ? meta : {},
    });
    if (type === 'artifact_shared') await mirrorArtifactShare(db, req, meta);
    if (type === 'artifact_visit') await mirrorArtifactVisit(db, req, meta);
    res.json({ ok: true });
  } catch (err) {
    logger.error('loop event failed', { route: 'loop' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const CHANNEL_RE = { whatsapp: /^\+?[\d\s-]{7,20}$/, email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ };

router.post('/capture', async (req, res) => {
  try {
    const { channel, contact, source, ref, url } = req.body || {};
    const c = String(channel || '');
    const value = String(contact || '').trim().slice(0, 120);
    if (!CHANNEL_RE[c] || !CHANNEL_RE[c].test(value)) {
      return res.status(400).json({ error: 'valid whatsapp number or email required' });
    }
    const src = ['try-invite', 'couple-card', 'gift'].includes(String(source)) ? String(source) : 'try-invite';
    const db = getDb();
    await db.insert(loopCaptures).values({ channel: c, contact: value, source: src, ref: ref ? String(ref).slice(0, 120) : null });
    await logFunnelEvent(db, { eventType: 'loop_capture', source: 'web', metadata: { channel: c, src } });
    // Outbound: phone contacts get the artifact via iMessage (Linq rail).
    // Email contacts are captured for a future send rail — no provider yet.
    let sent = false;
    const artifactUrl = url ? String(url).slice(0, 500) : null;
    if (c === 'whatsapp' && artifactUrl) {
      try {
        await sendMessage({
          to: value,
          text: 'Your OnPoint look is ready',
          linkUrl: artifactUrl,
          idempotencyKey: `capture-${src}-${value.slice(-6)}`,
        });
        sent = true;
      } catch (sendErr) {
        logger.warn('capture send failed', { route: 'loop', src }, sendErr);
      }
    }
    res.json({ ok: true, sent });
  } catch (err) {
    logger.error('loop capture failed', { route: 'loop' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/cards', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const db = getDb();
    const rows = await db
      .select({ id: coupleCards.id, cardUrl: coupleCards.cardUrl, theme: coupleCards.theme, senderName: coupleCards.senderName, createdAt: coupleCards.createdAt })
      .from(coupleCards)
      .where(eq(coupleCards.listed, true))
      .orderBy(desc(coupleCards.createdAt))
      .limit(limit);
    res.json({ cards: rows });
  } catch (err) {
    logger.error('card feed failed', { route: 'loop' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ops read: recent opt-ins (service-key gated — feeds the send rail).
router.get('/captures', (req, res, next) => {
  const serviceKey = process.env.SERVICE_API_KEY;
  if (serviceKey) {
    const provided = req.headers['x-service-key'] ?? req.headers['authorization']?.replace('Bearer ', '')?.trim();
    if (provided !== serviceKey) return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}, async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.select().from(loopCaptures).orderBy(desc(loopCaptures.createdAt)).limit(200);
    res.json({ captures: rows });
  } catch (err) {
    logger.error('captures read failed', { route: 'loop' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
