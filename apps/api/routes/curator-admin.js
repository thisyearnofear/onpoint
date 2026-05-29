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
const { curators, listings } = require('@repo/db');
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

  try {
    const rows = await db
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

    res.json({ curators: rows, total: rows.length });
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

module.exports = router;
