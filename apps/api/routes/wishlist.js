/**
 * Wishlist Routes — /api/wishlist
 *
 * Shareable "things I want" / "things I want to see you in" lists.
 * No account: the list id is the capability (unguessable uuid).
 *   POST /api/wishlist              { kind?, ownerName?, items? }  → create
 *   POST /api/wishlist/:id/items    { item: {listingId, curatorSlug, title, imageUrl} }
 *   GET  /api/wishlist/:id          → public list view (no price)
 */

const express = require('express');
const { eq } = require('drizzle-orm');
const { wishlists } = require('@repo/db');
const { getDb } = require('../lib/db');
const { logFunnelEvent } = require('../lib/funnel');
const logger = require('../lib/logger');

const router = express.Router();
const ID_RE = /^[a-f0-9-]{36}$/;

function cleanItem(item) {
  if (!item || typeof item !== 'object') return null;
  if (!item.listingId) return null;
  return {
    listingId: String(item.listingId).slice(0, 80),
    curatorSlug: item.curatorSlug ? String(item.curatorSlug).slice(0, 80) : null,
    title: item.title ? String(item.title).slice(0, 120) : null,
    imageUrl: item.imageUrl ? String(item.imageUrl).slice(0, 500) : null,
  };
}

const publicView = (row) => ({
  id: row.id,
  kind: row.kind,
  ownerName: row.ownerName,
  items: row.items || [],
  createdAt: row.createdAt,
});

router.post('/', async (req, res) => {
  try {
    const { kind, ownerName, items } = req.body || {};
    const clean = Array.isArray(items) ? items.map(cleanItem).filter(Boolean).slice(0, 24) : [];
    const db = getDb();
    const [row] = await db
      .insert(wishlists)
      .values({
        kind: kind === 'see-you-in' ? 'see-you-in' : 'want',
        ownerName: ownerName ? String(ownerName).slice(0, 60) : null,
        items: clean,
      })
      .returning();
    await logFunnelEvent(db, { eventType: 'wishlist_created', source: 'web', metadata: { kind: row.kind, count: clean.length } });
    const base = process.env.WEB_BASE_URL || 'https://onpoint.trustfall.xyz';
    res.json({ id: row.id, url: `${base}/w/${row.id}` });
  } catch (err) {
    logger.error('wishlist create failed', { route: 'wishlist' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/items', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid list id' });
    const item = cleanItem(req.body?.item);
    if (!item) return res.status(400).json({ error: 'item.listingId required' });
    const db = getDb();
    const [row] = await db.select().from(wishlists).where(eq(wishlists.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: 'list not found' });
    const items = row.items || [];
    if (!items.some((i) => i.listingId === item.listingId)) items.push(item);
    await db.update(wishlists).set({ items }).where(eq(wishlists.id, id));
    res.json({ ok: true, count: items.length });
  } catch (err) {
    logger.error('wishlist append failed', { route: 'wishlist' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid list id' });
    const db = getDb();
    const [row] = await db.select().from(wishlists).where(eq(wishlists.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: 'list not found' });
    await logFunnelEvent(db, { eventType: 'wishlist_viewed', source: 'web', metadata: { listId: row.id, kind: row.kind } });
    res.json(publicView(row));
  } catch (err) {
    logger.error('wishlist lookup failed', { route: 'wishlist' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
