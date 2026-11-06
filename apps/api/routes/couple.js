/**
 * Couple Card Routes — /api/couple
 *
 * ADR 0026: one photo of two people + a look (or listings) → a "couple
 * goals" card (hero photo + item strip). The card is the share artifact;
 * items ride under it and route to storefronts / gift claims.
 *
 *   POST /api/couple/render      { photoData, lookSlug?|listingIds[]?, theme?, senderName? }
 *   GET  /api/couple/card/:id    → public card view (no price, unlisted)
 */

const express = require('express');
const { eq, inArray } = require('drizzle-orm');
const { coupleCards, agentLooks, listings } = require('@repo/db');
const { getDb } = require('../lib/db');
const { keyToUrl } = require('../lib/r2');
const { composeCoupleCard } = require('../lib/image-composite');
const { logFunnelEvent } = require('../lib/funnel');
const logger = require('../lib/logger');

const router = express.Router();
const ID_RE = /^[a-f0-9-]{36}$/;

async function resolveItems(db, { lookSlug, listingIds }) {
  let ids = Array.isArray(listingIds) ? listingIds.filter(Boolean).slice(0, 6) : null;
  let lookTitle = null;
  if (!ids && lookSlug) {
    const [look] = await db.select().from(agentLooks).where(eq(agentLooks.slug, String(lookSlug))).limit(1);
    if (!look) return { items: [], lookTitle: null, notFound: true };
    ids = (look.listingIds || []).slice(0, 6);
    lookTitle = look.title || null;
  }
  if (!ids || ids.length === 0) return { items: [], lookTitle, notFound: false };
  const rows = await db.select().from(listings).where(inArray(listings.id, ids));
  return {
    lookTitle,
    notFound: false,
    items: rows.map((l) => ({
      listingId: l.id,
      curatorSlug: l.curatorSlug || null,
      title: l.title || null,
      imageUrl: l.photoKeys?.[0] ? keyToUrl(l.photoKeys[0]) : null,
    })),
  };
}

const PHOTO_BYTES_MAX = 8_000_000; // ~6 MB image as base64 — the 10mb body cap stays the backstop

router.post('/render', async (req, res) => {
  try {
    const { photoData, lookSlug, listingIds, theme, senderName, listed, shareId, shareChannel, replyTo } = req.body || {};
    if (!photoData || !String(photoData).startsWith('data:image/')) {
      return res.status(400).json({ error: 'photoData (data:image/...) required' });
    }
    if (String(photoData).length > PHOTO_BYTES_MAX) {
      return res.status(413).json({ error: 'photo too large — under 6 MB' });
    }
    if (!lookSlug && (!Array.isArray(listingIds) || listingIds.length === 0)) {
      return res.status(400).json({ error: 'lookSlug or listingIds required' });
    }
    const db = getDb();
    const { items, lookTitle, notFound } = await resolveItems(db, { lookSlug, listingIds });
    if (notFound) return res.status(404).json({ error: 'look not found' });

    const { r2Key, url } = await composeCoupleCard({
      photoBase64: photoData,
      items,
      theme: theme ? String(theme).slice(0, 48) : lookTitle || 'Couple goals',
      senderName: senderName ? String(senderName).slice(0, 60) : null,
    });

    const [card] = await db
      .insert(coupleCards)
      .values({
        r2Key,
        cardUrl: url,
        theme: theme || lookTitle || null,
        senderName: senderName || null,
        items,
        // Sender opt-out from the public board; unlisted cards still resolve by link.
        listed: listed !== false,
        replyTo: replyTo && ID_RE.test(String(replyTo)) ? String(replyTo) : null,
      })
      .returning({ id: coupleCards.id });

    await logFunnelEvent(db, {
      eventType: 'couple_card_created',
      source: 'web',
      metadata: {
        cardId: card.id,
        surface: 'couple',
        ...(shareId ? { shareId: String(shareId).slice(0, 24), shareChannel: String(shareChannel || 'direct').slice(0, 24) } : {}),
      },
    });
    const base = process.env.WEB_BASE_URL || 'https://onpoint.trustfall.xyz';
    res.json({ id: card.id, cardUrl: url, pageUrl: `${base}/c/${card.id}`, items });
  } catch (err) {
    logger.error('couple render failed', { route: 'couple' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/card/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid card id' });
    const db = getDb();
    const [row] = await db.select().from(coupleCards).where(eq(coupleCards.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: 'card not found' });
    await logFunnelEvent(db, { eventType: 'couple_card_viewed', source: 'web', metadata: { cardId: row.id, surface: 'couple' } });
    res.json({
      id: row.id,
      cardUrl: row.cardUrl,
      theme: row.theme,
      senderName: row.senderName,
      items: row.items || [],
      listed: row.listed,
      replyTo: row.replyTo || null,
      createdAt: row.createdAt,
    });
  } catch (err) {
    logger.error('couple card lookup failed', { route: 'couple', id: req.params.id }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Possession of the link is the authority to delist — same capability model
// as the wishlist. The photographed person can't consent at creation, so the
// board gives them an exit: report drops the card off the public feed while
// the direct link keeps working for whoever has it.
router.post('/card/:id/report', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid card id' });
    const db = getDb();
    const updated = await db
      .update(coupleCards)
      .set({ listed: false })
      .where(eq(coupleCards.id, id))
      .returning({ id: coupleCards.id });
    if (updated.length === 0) return res.status(404).json({ error: 'card not found' });
    await logFunnelEvent(db, { eventType: 'card_reported', source: 'web', metadata: { cardId: id, surface: 'cards' } });
    res.json({ listed: false });
  } catch (err) {
    logger.error('card report failed', { route: 'couple', id: req.params.id }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
