/**
 * Loop Routes — /api/loop
 *
 * Viral loop instrumentation + recipient capture:
 *   POST /api/loop/event    { type, meta }   → funnel event on loop hops
 *   POST /api/loop/capture  { channel, contact, source, ref } → opt-in
 *   GET  /api/loop/cards?limit= → recent public couple cards (the feed)
 */

const express = require('express');
const { desc } = require('drizzle-orm');
const { loopCaptures, coupleCards } = require('@repo/db');
const { getDb } = require('../lib/db');
const { logFunnelEvent } = require('../lib/funnel');
const logger = require('../lib/logger');

const router = express.Router();

const EVENT_TYPES = new Set([
  'invite_opened', 'invite_rendered',
  'couple_card_created', 'couple_card_viewed',
  'gift_opened', 'gift_claimed', 'card_feed_viewed',
]);

router.post('/event', async (req, res) => {
  try {
    const { type, meta } = req.body || {};
    if (!type || !EVENT_TYPES.has(String(type))) {
      return res.status(400).json({ error: 'unknown event type' });
    }
    await logFunnelEvent(getDb(), {
      eventType: String(type),
      source: 'web',
      metadata: meta && typeof meta === 'object' ? meta : {},
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error('loop event failed', { route: 'loop' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const CHANNEL_RE = { whatsapp: /^\+?[\d\s-]{7,20}$/, email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ };

router.post('/capture', async (req, res) => {
  try {
    const { channel, contact, source, ref } = req.body || {};
    const c = String(channel || '');
    const value = String(contact || '').trim().slice(0, 120);
    if (!CHANNEL_RE[c] || !CHANNEL_RE[c].test(value)) {
      return res.status(400).json({ error: 'valid whatsapp number or email required' });
    }
    const src = ['try-invite', 'couple-card', 'gift'].includes(String(source)) ? String(source) : 'try-invite';
    const db = getDb();
    await db.insert(loopCaptures).values({ channel: c, contact: value, source: src, ref: ref ? String(ref).slice(0, 120) : null });
    await logFunnelEvent(db, { eventType: 'loop_capture', source: 'web', metadata: { channel: c, src } });
    res.json({ ok: true });
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
      .orderBy(desc(coupleCards.createdAt))
      .limit(limit);
    res.json({ cards: rows });
  } catch (err) {
    logger.error('card feed failed', { route: 'loop' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
