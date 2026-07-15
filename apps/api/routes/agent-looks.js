/**
 * Agent Looks API — /api/looks
 *
 * External agents compose OnPoint listings into shareable "looks" / style boards.
 * The look page at /look/:slug is public — anyone can view, try on, and share.
 *
 * Revenue model: when a look drives a try-on or purchase, the creating agent
 * earns referral commission (2.5% of order value). The look's referral code
 * is auto-embedded in all try-on and order flows originating from the look page.
 *
 * Routes:
 *   POST   /api/looks              — create a look (agent auth)
 *   GET    /api/looks              — list looks (public, filterable)
 *   GET    /api/looks/:slug        — get a look with resolved listings (public)
 *   PATCH  /api/looks/:slug        — update a look (agent auth, owner only)
 *   DELETE /api/looks/:slug        — archive a look (agent auth, owner only)
 *   POST   /api/looks/:slug/image  — upload cover image (agent auth, owner only)
 *   POST   /api/looks/:slug/share  — record a share event (public, increments count)
 */

const express = require('express');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, and, desc, sql, ilike, inArray } = require('drizzle-orm');
const { agentLooks, listings, curators, kitSkus } = require('@repo/db');
const { upload: r2Upload, publicUrl: r2PublicUrl } = require('@repo/storage');
const logger = require('../lib/logger');

const router = express.Router();

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

function getDb() {
  if (!CONNECTION_STRING) throw new Error('NEON_DATABASE_URL not configured');
  return drizzle(neon(CONNECTION_STRING));
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function generateUniqueSlug(base) {
  const slug = slugify(base);
  if (slug.length < 3) return `look-${Date.now().toString(36)}`;
  return `${slug}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Resolve listing IDs to full listing objects with kit + image ──
async function resolveListings(db, listingIds) {
  if (!listingIds || listingIds.length === 0) return [];

  const rows = await db
    .select({
      listing: listings,
      kit: kitSkus,
    })
    .from(listings)
    .leftJoin(kitSkus, eq(listings.skuId, kitSkus.id))
    .where(inArray(listings.id, listingIds));

  // Preserve the order from listingIds
  const map = new Map(rows.map((r) => [r.listing.id, r]));
  return listingIds
    .map((id) => map.get(id))
    .filter(Boolean);
}

function listingImageUrl(listing) {
  if (listing.photoKeys && listing.photoKeys.length > 0) {
    return r2PublicUrl(listing.photoKeys[0]);
  }
  if (listing.officialImageKey) {
    return r2PublicUrl(listing.officialImageKey);
  }
  return null;
}

// ── Auth middleware: extract agent address from header ──
function agentAuth(req, res, next) {
  const agentAddress = req.headers['x-agent-address'];
  if (!agentAddress || !/^0x[a-fA-F0-9]{40}$/.test(agentAddress)) {
    return res.status(401).json({ error: 'Valid x-agent-address header required' });
  }
  req.agentAddress = agentAddress;
  next();
}

// ── POST /api/looks — create a look ──
router.post('/', agentAuth, async (req, res) => {
  try {
    const db = getDb();
    const { title, description, listingIds, heroListingId, curatorSlug, tags, coverImage } = req.body;

    if (!title || !listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return res.status(400).json({ error: 'title and listingIds[] are required' });
    }

    // Validate listing IDs exist
    const valid = await db
      .select({ id: listings.id })
      .from(listings)
      .where(inArray(listings.id, listingIds))
      .limit(listingIds.length);

    if (valid.length !== listingIds.length) {
      return res.status(400).json({ error: 'One or more listingIds not found' });
    }

    const slug = generateUniqueSlug(title);

    // Upload cover image if provided
    let coverImageKey = null;
    if (coverImage && coverImage.startsWith('data:')) {
      const ext = coverImage.match(/data:image\/(\w+)/)?.[1] || 'jpg';
      coverImageKey = `looks/${slug}/cover.${ext}`;
      await r2Upload(coverImageKey, Buffer.from(coverImage.split(',')[1], 'base64'), `image/${ext}`);
    }

    const [look] = await db
      .insert(agentLooks)
      .values({
        agentAddress: req.agentAddress,
        slug,
        title,
        description: description || null,
        listingIds,
        heroListingId: heroListingId || listingIds[0],
        curatorSlug: curatorSlug || null,
        coverImageKey,
        tags: tags || [],
      })
      .returning();

    logger.info('Look created', {
      component: 'agent-looks',
      slug,
      agentAddress: req.agentAddress,
      listingCount: listingIds.length,
    });

    res.status(201).json(look);
  } catch (err) {
    logger.error('Failed to create look', { component: 'agent-looks' }, err);
    res.status(500).json({ error: err.message?.slice(0, 200) || 'Failed to create look' });
  }
});

// ── GET /api/looks — list looks (public) ──
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { curator, tag, agent, limit } = req.query;
    const lim = Math.min(parseInt(limit) || 20, 100);

    let query = db
      .select()
      .from(agentLooks)
      .where(eq(agentLooks.status, 'live'))
      .orderBy(desc(agentLooks.createdAt))
      .limit(lim);

    const conditions = [eq(agentLooks.status, 'live')];
    if (curator) conditions.push(eq(agentLooks.curatorSlug, curator));
    if (agent) conditions.push(eq(agentLooks.agentAddress, agent));
    if (tag) conditions.push(sql`${agentLooks.tags} @> ARRAY[${tag}]::text[]`);

    const looks = await db
      .select()
      .from(agentLooks)
      .where(and(...conditions))
      .orderBy(desc(agentLooks.createdAt))
      .limit(lim);

    res.json({ looks, count: looks.length });
  } catch (err) {
    logger.error('Failed to list looks', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to list looks' });
  }
});

// ── GET /api/looks/:slug — get a look with resolved listings ──
router.get('/:slug', async (req, res) => {
  try {
    const db = getDb();

    const [look] = await db
      .select()
      .from(agentLooks)
      .where(eq(agentLooks.slug, req.params.slug))
      .limit(1);

    if (!look) {
      return res.status(404).json({ error: 'Look not found' });
    }
    if (look.status !== 'live') {
      return res.status(404).json({ error: 'Look not available' });
    }

    // Resolve listings with kit data
    const resolvedListings = await resolveListings(db, look.listingIds);

    const items = resolvedListings.map(({ listing, kit }) => ({
      id: listing.id,
      title: listing.title || (kit ? `${kit.club} ${kit.kitType}` : 'Item'),
      curatorSlug: listing.curatorSlug,
      imageUrl: listingImageUrl(listing),
      isHero: listing.id === look.heroListingId,
      sizes: listing.sizes,
      tags: listing.tags,
      kit: kit ? { club: kit.club, kitType: kit.kitType, brand: kit.brand } : null,
    }));

    // Generate referral code for the look's agent
    const referralCode = `ref_${look.agentAddress.slice(2, 10)}`;

    res.json({
      ...look,
      coverImageUrl: look.coverImageKey ? r2PublicUrl(look.coverImageKey) : null,
      items,
      referralCode,
      shareUrl: `https://beonpoint.netlify.app/look/${look.slug}`,
    });
  } catch (err) {
    logger.error('Failed to get look', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to get look' });
  }
});

// ── PATCH /api/looks/:slug — update a look (owner only) ──
router.patch('/:slug', agentAuth, async (req, res) => {
  try {
    const db = getDb();

    const [existing] = await db
      .select()
      .from(agentLooks)
      .where(eq(agentLooks.slug, req.params.slug))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'Look not found' });
    if (existing.agentAddress !== req.agentAddress) {
      return res.status(403).json({ error: 'Not the look owner' });
    }

    const { title, description, tags, status } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (tags !== undefined) updates.tags = tags;
    if (status !== undefined) updates.status = status;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const [updated] = await db
      .update(agentLooks)
      .set(updates)
      .where(eq(agentLooks.slug, req.params.slug))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error('Failed to update look', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to update look' });
  }
});

// ── POST /api/looks/:slug/image — upload cover image (owner only) ──
router.post('/:slug/image', agentAuth, async (req, res) => {
  try {
    const db = getDb();

    const [existing] = await db
      .select()
      .from(agentLooks)
      .where(eq(agentLooks.slug, req.params.slug))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'Look not found' });
    if (existing.agentAddress !== req.agentAddress) {
      return res.status(403).json({ error: 'Not the look owner' });
    }

    const { image } = req.body;
    if (!image || !image.startsWith('data:')) {
      return res.status(400).json({ error: 'image (data URI) required' });
    }

    const ext = image.match(/data:image\/(\w+)/)?.[1] || 'jpg';
    const key = `looks/${existing.slug}/cover.${ext}`;
    await r2Upload(key, Buffer.from(image.split(',')[1], 'base64'), `image/${ext}`);

    await db
      .update(agentLooks)
      .set({ coverImageKey: key, updatedAt: new Date() })
      .where(eq(agentLooks.slug, existing.slug));

    res.json({ coverImageKey: key, coverImageUrl: r2PublicUrl(key) });
  } catch (err) {
    logger.error('Failed to upload look image', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ── POST /api/looks/:slug/share — record a share event ──
router.post('/:slug/share', async (req, res) => {
  try {
    const db = getDb();

    await db.execute(sql`
      UPDATE agent_looks
      SET share_count = share_count + 1, updated_at = now()
      WHERE slug = ${req.params.slug} AND status = 'live'
    `);

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to record share', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

// ── POST /api/looks/:slug/try-on-count — increment try-on count ──
// Called by the try-on flow when a try-on is initiated via a look
router.post('/:slug/try-on-count', async (req, res) => {
  try {
    const db = getDb();

    await db.execute(sql`
      UPDATE agent_looks
      SET try_on_count = try_on_count + 1, updated_at = now()
      WHERE slug = ${req.params.slug} AND status = 'live'
    `);

    res.json({ success: true });
  } catch (err) {
    // Non-fatal — don't fail the try-on
    logger.warn('Failed to increment try-on count', { component: 'agent-looks', slug: req.params.slug });
    res.status(200).json({ success: false });
  }
});

module.exports = router;
