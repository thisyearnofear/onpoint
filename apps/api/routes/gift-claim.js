/**
 * Gift Claim Routes — /api/gift
 *
 * Public, no-auth claim flow for gifted orders (ADR 0025):
 *   buyer pays → order carries a claimToken → recipient opens /gift/{token}
 *   → GET returns the wrapped-card view (item, sender note — never price)
 *   → POST captures shipping address (+ optional size when buyer chose "ask her").
 *
 * A claim token is 128-bit random, single-use (POST 410s once claimed),
 * and this route never exposes price or payment fields.
 */

const express = require('express');
const { eq, isNull, and } = require('drizzle-orm');
const { orders, listings } = require('@repo/db');
const { getDb } = require('../lib/db');
const { keyToUrl } = require('../lib/r2');
const logger = require('../lib/logger');

const router = express.Router();

const TOKEN_RE = /^[a-f0-9-]{36}$/;

function publicView(row, listing) {
  return {
    claimed: Boolean(row.claimedAt || row.shippingAddress),
    recipientName: row.recipientName || null,
    note: row.giftNote || null,
    item: listing
      ? {
          title: listing.title || null,
          imageUrl: listing.photoKeys?.[0] ? keyToUrl(listing.photoKeys[0]) : null,
          size: row.size,
        }
      : null,
    needsSize: false,
  };
}

router.get('/:token', async (req, res) => {
  const token = String(req.params.token || '');
  if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'invalid token' });
  const db = getDb();
  const [row] = await db.select().from(orders).where(eq(orders.claimToken, token)).limit(1);
  if (!row) return res.status(404).json({ error: 'gift not found' });
  const [listing] = row.listingId
    ? await db.select().from(listings).where(eq(listings.id, row.listingId)).limit(1)
    : [null];
  res.json(publicView(row, listing));
});

router.post('/:token', async (req, res) => {
  const token = String(req.params.token || '');
  if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'invalid token' });
  const address = req.body?.address?.toString().trim();
  const size = req.body?.size?.toString().trim();
  if (!address || address.length < 8 || address.length > 500) {
    return res.status(400).json({ error: 'shipping address required' });
  }
  const db = getDb();
  // Single-use guard: only the first POST wins (claimed_at still null).
  const updated = await db
    .update(orders)
    .set({
      shippingAddress: address,
      ...(size ? { size } : {}),
      claimedAt: new Date(),
    })
    .where(and(eq(orders.claimToken, token), isNull(orders.claimedAt)))
    .returning({ id: orders.id });
  if (updated.length === 0) {
    const [existing] = await db.select().from(orders).where(eq(orders.claimToken, token)).limit(1);
    return res.status(existing ? 410 : 404).json({ error: existing ? 'already claimed' : 'gift not found' });
  }
  logger.info({ orderId: updated[0].id }, 'gift order claimed');
  res.json({ claimed: true });
});

module.exports = router;
