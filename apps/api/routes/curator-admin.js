/**
 * Curator Admin Routes — /api/admin/curators
 *
 * Internal admin endpoints for listing, viewing, updating, and deleting curators.
 * Protected by SERVICE_API_KEY (mounted at server.js with auth middleware).
 *
 * GET    /api/admin/curators         — list all curators (basic profile data)
 * GET    /api/admin/curators/:slug    — get single curator + listing count
 * DELETE /api/admin/curators/:slug    — remove a curator (and cascade listings)
 */

const express = require('express');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, desc, count, sql } = require('drizzle-orm');
const { curators, listings, kitSkus } = require('@repo/db');
const { upload, keyFor, remove } = require('@repo/storage');
const logger = require('../lib/logger');

const router = express.Router();

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;
let _sql = null;

function getDb() {
  if (!_sql) {
    if (!CONNECTION_STRING) {
      throw new Error('NEON_DATABASE_URL not configured');
    }
    _sql = neon(CONNECTION_STRING);
  }
  return drizzle(_sql, { schema: { curators, listings } });
}

function isValidSlug(slug) {
  return /^[a-z0-9-]{2,48}$/.test(slug);
}

// ── GET /api/admin/curators — list all curators ────────────────

router.get('/', async (req, res) => {
  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-admin' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : null;
  const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

  try {
    const [countResult] = await db
      .select({ total: count() })
      .from(curators);

    let rows;
    if (limit) {
      rows = await db
        .select({
          slug: curators.slug,
          name: curators.name,
          type: curators.type,
          verticals: curators.verticals,
          createdAt: curators.createdAt,
          channels: curators.channels,
          brand: curators.brand,
          commerce: curators.commerce,
          listingCount: sql`(
            SELECT COUNT(*)::int FROM ${listings}
            WHERE ${listings.curatorSlug} = ${curators.slug}
          )`.as('listing_count'),
        })
        .from(curators)
        .orderBy(desc(curators.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      rows = await db
        .select({
          slug: curators.slug,
          name: curators.name,
          type: curators.type,
          verticals: curators.verticals,
          createdAt: curators.createdAt,
          channels: curators.channels,
          brand: curators.brand,
          commerce: curators.commerce,
          listingCount: sql`(
            SELECT COUNT(*)::int FROM ${listings}
            WHERE ${listings.curatorSlug} = ${curators.slug}
          )`.as('listing_count'),
        })
        .from(curators)
        .orderBy(desc(curators.createdAt));
    }

    res.json({
      curators: rows,
      meta: {
        total: countResult?.total || 0,
        limit,
        offset,
      },
    });
  } catch (err) {
    logger.error('Failed to list curators', { component: 'curator-admin' }, err);
    res.status(500).json({ error: 'Failed to list curators' });
  }
});

// ── GET /api/admin/curators/:slug — get single curator ────────

router.get('/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-admin' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const [row] = await db
      .select()
      .from(curators)
      .where(eq(curators.slug, slug))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: 'Curator not found' });
    }

    // Get listing count
    const [listingCount] = await db
      .select({ count: count() })
      .from(listings)
      .where(eq(listings.curatorSlug, slug));

    res.json({
      curator: {
        ...row,
        listingCount: listingCount?.count || 0,
      },
    });
  } catch (err) {
    logger.error('Failed to get curator', { component: 'curator-admin', slug }, err);
    res.status(500).json({ error: 'Failed to get curator' });
  }
});

// ── PUT /api/admin/curators/:slug — update curator ────────────

router.put('/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-admin' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { name, verticals, channels, brand, commerce } = req.body;

  try {
    const [updated] = await db
      .update(curators)
      .set({
        ...(name ? { name } : {}),
        ...(verticals ? { verticals } : {}),
        ...(channels ? { channels } : {}),
        ...(brand ? { brand } : {}),
        ...(commerce ? { commerce } : {}),
      })
      .where(eq(curators.slug, slug))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Curator not found' });
    }

    logger.info('Curator updated', { component: 'curator-admin', slug });
    res.json({ curator: updated });
  } catch (err) {
    logger.error('Failed to update curator', { component: 'curator-admin', slug }, err);
    res.status(500).json({ error: 'Failed to update curator' });
  }
});

// ── DELETE /api/admin/curators/:slug — delete curator ─────────

router.delete('/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-admin' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const [deleted] = await db
      .delete(curators)
      .where(eq(curators.slug, slug))
      .returning({ slug: curators.slug });

    if (!deleted) {
      return res.status(404).json({ error: 'Curator not found' });
    }

    logger.info('Curator deleted', { component: 'curator-admin', slug });
    res.json({ success: true, slug: deleted.slug });
  } catch (err) {
    logger.error('Failed to delete curator', { component: 'curator-admin', slug }, err);
    res.status(500).json({ error: 'Failed to delete curator' });
  }
});

// ── GET /:slug/listings — list all listings for a curator ─────

router.get('/:slug/listings', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-admin' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : null;
  const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

  try {
    const [countResult] = await db
      .select({ total: count() })
      .from(listings)
      .where(eq(listings.curatorSlug, slug));

    let rows;
    if (limit) {
      rows = await db
        .select({
          listing: listings,
          kit: kitSkus,
        })
        .from(listings)
        .innerJoin(kitSkus, eq(listings.skuId, kitSkus.id))
        .where(eq(listings.curatorSlug, slug))
        .orderBy(desc(listings.updatedAt))
        .limit(limit)
        .offset(offset);
    } else {
      rows = await db
        .select({
          listing: listings,
          kit: kitSkus,
        })
        .from(listings)
        .innerJoin(kitSkus, eq(listings.skuId, kitSkus.id))
        .where(eq(listings.curatorSlug, slug))
        .orderBy(desc(listings.updatedAt));
    }

    res.json({
      slug,
      listings: rows.map(({ listing, kit }) => ({
        ...listing,
        kit: {
          id: kit.id,
          club: kit.club,
          season: kit.season,
          kitType: kit.kitType,
        },
      })),
      meta: {
        total: countResult?.total || 0,
        limit,
        offset,
      },
    });
  } catch (err) {
    logger.error('Failed to list curator listings', { component: 'curator-admin', slug }, err);
    res.status(500).json({ error: 'Failed to list listings' });
  }
});

// ── GET /:slug/listings/:id — get single listing ──────────────

router.get('/:slug/listings/:id', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const id = String(req.params.id || '');

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }
  if (!id || id.length < 8) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-admin' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const [row] = await db
      .select({
        listing: listings,
        kit: kitSkus,
      })
      .from(listings)
      .innerJoin(kitSkus, eq(listings.skuId, kitSkus.id))
      .where(eq(listings.id, id))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const { listing, kit } = row;

    res.json({
      listing: {
        ...listing,
        kit: {
          id: kit.id,
          club: kit.club,
          season: kit.season,
          kitType: kit.kitType,
        },
      },
    });
  } catch (err) {
    logger.error('Failed to get listing', { component: 'curator-admin', slug, listingId: id }, err);
    res.status(500).json({ error: 'Failed to get listing' });
  }
});

// ── PUT /:slug/listings/:id — update a listing ────────────────

router.put('/:slug/listings/:id', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const id = String(req.params.id || '');

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }
  if (!id || id.length < 8) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-admin' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { status, sizes, photoKeys } = req.body;

  try {
    const updateData = {};
    if (status) updateData.status = status;
    if (sizes) updateData.sizes = sizes;
    if (photoKeys) updateData.photoKeys = photoKeys;
    updateData.updatedAt = new Date().toISOString();

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const [updated] = await db
      .update(listings)
      .set(updateData)
      .where(eq(listings.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    logger.info('Listing updated', { component: 'curator-admin', slug, listingId: id, status });
    res.json({ listing: updated });
  } catch (err) {
    logger.error('Failed to update listing', { component: 'curator-admin', slug, listingId: id }, err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// ── POST /:slug/listings/:id/photos — upload photo to R2 ─────

router.post('/:slug/listings/:id/photos', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const id = String(req.params.id || '');

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }
  if (!id || id.length < 8) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  const { photo: base64Photo } = req.body;
  if (!base64Photo || typeof base64Photo !== 'string') {
    return res.status(400).json({ error: 'photo (base64 string) is required' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-admin' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    // Parse base64: "data:image/jpeg;base64,/9j/4AAQ..." or raw base64
    const match = base64Photo.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/);
    let buffer, contentType;

    if (match) {
      contentType = match[1];
      buffer = Buffer.from(match[2], 'base64');
    } else {
      // Assume JPEG if no data URI prefix
      contentType = 'image/jpeg';
      buffer = Buffer.from(base64Photo, 'base64');
    }

    // Reject images larger than 10MB
    const MAX_BYTES = 10 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      return res.status(400).json({
        error: `Image too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Maximum is 10MB.`,
      });
    }

    // Get current listing to determine the photo index for the key
    const [current] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);

    if (!current) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const nextIndex = (current.photoKeys?.length || 0) + 1;
    const r2Key = keyFor.listingPhoto(slug, id, nextIndex);

    await upload(r2Key, buffer, contentType);

    // Append the new key and update the listing
    const updatedPhotoKeys = [...(current.photoKeys || []), r2Key];

    const [updated] = await db
      .update(listings)
      .set({
        photoKeys: updatedPhotoKeys,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(listings.id, id))
      .returning();

    logger.info('Listing photo uploaded', {
      component: 'curator-admin',
      slug,
      listingId: id,
      r2Key,
      bytes: buffer.length,
    });

    res.json({ listing: updated, r2Key });
  } catch (err) {
    logger.error('Failed to upload photo', { component: 'curator-admin', slug, listingId: id }, err);
    res.status(500).json({ error: `Failed to upload photo: ${err.message}` });
  }
});

// ── DELETE /:slug/listings/:id/photos — delete a photo ──────

router.delete('/:slug/listings/:id/photos', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const id = String(req.params.id || '');

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }
  if (!id || id.length < 8) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  const { photoKey } = req.body;
  if (!photoKey || typeof photoKey !== 'string') {
    return res.status(400).json({ error: 'photoKey (string) is required' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-admin' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    // Get current listing to read existing photoKeys
    const [current] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);

    if (!current) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const currentKeys = current.photoKeys || [];
    if (!currentKeys.includes(photoKey)) {
      return res.status(404).json({ error: 'Photo key not found on this listing' });
    }

    // Delete from R2 (ignore if already gone)
    try {
      await remove(photoKey);
    } catch (r2Err) {
      logger.warn('R2 delete failed (continuing)', {
        component: 'curator-admin',
        photoKey,
        error: r2Err.message,
      });
    }

    // Remove key from array and update listing
    const updatedPhotoKeys = currentKeys.filter((k) => k !== photoKey);

    const [updated] = await db
      .update(listings)
      .set({
        photoKeys: updatedPhotoKeys,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(listings.id, id))
      .returning();

    logger.info('Listing photo deleted', {
      component: 'curator-admin',
      slug,
      listingId: id,
      photoKey,
    });

    res.json({ listing: updated });
  } catch (err) {
    logger.error('Failed to delete photo', { component: 'curator-admin', slug, listingId: id }, err);
    res.status(500).json({ error: `Failed to delete photo: ${err.message}` });
  }
});

// ── GET /api/admin/curators/:slug/ledger — payout ledger (owed vs paid) ──
router.get('/:slug/ledger', async (req, res) => {
  const slug = String(req.params.slug || '');
  try {
    const db = getDb();
    const { orders: ordersTable } = require('@repo/db');
    const { eq, sql, and, isNull } = require('drizzle-orm');

    // Aggregate owed vs paid for this curator
    const rows = await db
      .select({
        total: sql`count(*)::int`,
        totalCusd: sql`coalesce(sum(${ordersTable.amountCusd}::numeric), 0)::text`,
        paidCount: sql`count(*) filter (where ${ordersTable.payoutTxHash} is not null)::int`,
        paidCusd: sql`coalesce(sum(${ordersTable.amountCusd}::numeric) filter (where ${ordersTable.payoutTxHash} is not null), 0)::text`,
        owedCount: sql`count(*) filter (where ${ordersTable.payoutTxHash} is null and ${ordersTable.paymentTxHash} is not null)::int`,
        owedCusd: sql`coalesce(sum(${ordersTable.amountCusd}::numeric) filter (where ${ordersTable.payoutTxHash} is null and ${ordersTable.paymentTxHash} is not null), 0)::text`,
        cancelledCount: sql`count(*) filter (where ${ordersTable.status} = 'cancelled')::int`,
        disputedCount: sql`count(*) filter (where ${ordersTable.status} = 'disputed')::int`,
      })
      .from(ordersTable)
      .where(eq(ordersTable.curatorSlug, slug));

    const summary = rows[0] || {};

    // Recent orders with payout status
    const recentOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.curatorSlug, slug))
      .orderBy(sql`${ordersTable.createdAt} desc`)
      .limit(20);

    // Get curator for split info
    const [curator] = await db.select().from(curators).where(eq(curators.slug, slug)).limit(1);

    res.json({
      curator: {
        slug,
        walletAddress: curator?.commerce?.walletAddress || null,
        splitAddress: curator?.commerce?.splitAddress || null,
        revShare: curator?.commerce?.revShare ?? 0.05,
        payoutModel: curator?.commerce?.splitAddress ? '0xSplits (non-custodial)' : 'custodial',
      },
      summary: {
        totalOrders: summary.total || 0,
        totalCusd: summary.totalCusd || '0',
        paidOrders: summary.paidCount || 0,
        paidCusd: summary.paidCusd || '0',
        owedOrders: summary.owedCount || 0,
        owedCusd: summary.owedCusd || '0',
        cancelledOrders: summary.cancelledCount || 0,
        disputedOrders: summary.disputedCount || 0,
      },
      recentOrders,
    });
  } catch (err) {
    logger.error('Failed to get curator ledger', { component: 'curator-admin', slug }, err);
    res.status(500).json({ error: 'Failed to get ledger' });
  }
});

// ── POST /api/admin/curators/:slug/setup-split ──
// Deploy a 0xSplits SplitV2 for an existing curator who doesn't have one yet.
// Requires the curator to have commerce.walletAddress set.
router.post('/:slug/setup-split', async (req, res) => {
  const slug = String(req.params.slug || '');

  try {
    const db = getDb();
    const [curator] = await db.select().from(curators).where(eq(curators.slug, slug)).limit(1);

    if (!curator) {
      return res.status(404).json({ error: 'Curator not found' });
    }

    const walletAddress = curator.commerce?.walletAddress;
    if (!walletAddress) {
      return res.status(409).json({
        error: 'Curator has no walletAddress configured — set one first',
      });
    }

    if (curator.commerce?.splitAddress) {
      return res.status(409).json({
        error: 'Split already deployed',
        splitAddress: curator.commerce.splitAddress,
      });
    }

    const { deployCuratorSplit } = require('../lib/split-setup');
    const revShare = curator.commerce?.revShare ?? 0.05;
    const { splitAddress, txHash } = await deployCuratorSplit(walletAddress, revShare);

    // Save split address to curator commerce
    const updatedCommerce = {
      ...curator.commerce,
      splitAddress,
      splitTxHash: txHash,
    };
    await db.update(curators).set({ commerce: updatedCommerce }).where(eq(curators.slug, slug));

    logger.info('Split deployed for existing curator', {
      component: 'curator-admin', slug, splitAddress, txHash,
    });

    res.status(201).json({
      success: true,
      splitAddress,
      txHash,
      payoutModel: '0xSplits (non-custodial)',
    });
  } catch (err) {
    logger.error('Failed to deploy split', { component: 'curator-admin', slug }, err);
    res.status(500).json({ error: `Failed to deploy split: ${err.message}` });
  }
});

module.exports = router;

