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
const logger = require('../lib/logger');

const router = express.Router();

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

router.post('/render', async (req, res) => {
  try {
    const { photoData, lookSlug, listingIds, theme, senderName } = req.body || {};
    if (!photoData || !String(photoData).startsWith('data:image/')) {
      return res.status(400).json({ error: 'photoData (data:image/...) required' });
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
      .values({ r2Key, cardUrl: url, theme: theme || lookTitle || null, senderName: senderName || null, items })
      .returning({ id: coupleCards.id });

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
    if (!/^[a-f0-9-]{36}$/.test(id)) return res.status(400).json({ error: 'invalid card id' });
    const db = getDb();
    const [row] = await db.select().from(coupleCards).where(eq(coupleCards.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: 'card not found' });
    res.json({
      id: row.id,
      cardUrl: row.cardUrl,
      theme: row.theme,
      senderName: row.senderName,
      items: row.items || [],
      createdAt: row.createdAt,
    });
  } catch (err) {
    logger.error('couple card lookup failed', { route: 'couple', id: req.params.id }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
