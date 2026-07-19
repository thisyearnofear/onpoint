/**
 * Agent Looks API — /api/looks
 *
 * Anyone with a wallet can compose OnPoint listings into shareable "looks" /
 * style boards. The look page at /look/:slug is public — anyone can view, try
 * on, and share.
 *
 * Revenue model: when a look drives a try-on or purchase, the creator earns
 * referral commission (2.5% of order value). The look's referral code is
 * auto-embedded in all try-on and order flows originating from the look page.
 *
 * Auth (two paths):
 *   1. Agent: x-agent-address header (wallet address)
 *   2. Curator: x-curator-slug + x-curator-whatsapp headers (WhatsApp verification)
 *      — the curator's wallet address (from commerce.walletAddress or their
 *        linkedAgentAddress) is used as the look creator address
 *
 * Routes:
 *   POST   /api/looks              — create a look (agent or curator auth)
 *   GET    /api/looks              — list looks (public, filterable)
 *   GET    /api/looks/:slug        — get a look with resolved listings (public)
 *   PATCH  /api/looks/:slug        — update a look (creator only)
 *   DELETE /api/looks/:slug        — archive a look (creator only)
 *   POST   /api/looks/:slug/image  — upload cover image (creator only)
 *   POST   /api/looks/:slug/share  — record a share event (public, increments count)
 *   POST   /api/looks/curator/:slug/link-agent — set linkedAgentAddress (curator auth)
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

// ── Auth middleware: accept either agent (wallet header) or curator (slug + WhatsApp) ──
async function lookAuth(req, res, next) {
  // Path 1: Agent wallet address
  const agentAddress = req.headers['x-agent-address'];
  if (agentAddress && /^0x[a-fA-F0-9]{40}$/.test(agentAddress)) {
    req.creatorAddress = agentAddress;
    req.creatorType = 'agent';
    return next();
  }

  // Path 2: Curator slug + WhatsApp verification
  const curatorSlug = req.headers['x-curator-slug'];
  const curatorWhatsapp = req.headers['x-curator-whatsapp'];
  if (curatorSlug && curatorWhatsapp) {
    try {
      const db = getDb();
      const [curator] = await db
        .select()
        .from(curators)
        .where(eq(curators.slug, curatorSlug))
        .limit(1);

      if (!curator) {
        return res.status(401).json({ error: 'Curator not found' });
      }

      const storedWhatsapp = String(curator.channels?.whatsapp || '').replace(/\s/g, '');
      const providedWhatsapp = String(curatorWhatsapp).replace(/\s/g, '');
      if (!storedWhatsapp || storedWhatsapp !== providedWhatsapp) {
        return res.status(401).json({ error: 'WhatsApp verification failed' });
      }

      // Use the curator's wallet address as the creator address
      // If they have a linkedAgentAddress, use that; otherwise use commerce.walletAddress
      // If neither, generate a deterministic address from their slug (for referral tracking)
      const creatorAddress = curator.linkedAgentAddress
        || curator.commerce?.walletAddress
        || curator.commerce?.custodialWalletAddress;

      if (!creatorAddress) {
        return res.status(400).json({
          error: 'No wallet address found. Set up a payout wallet or link an agent address first.',
        });
      }

      req.creatorAddress = creatorAddress;
      req.creatorType = 'curator';
      req.curatorSlug = curatorSlug;
      return next();
    } catch (err) {
      logger.error('Curator auth failed', { component: 'agent-looks' }, err);
      return res.status(500).json({ error: 'Auth failed' });
    }
  }

  return res.status(401).json({
    error: 'Authentication required: x-agent-address header OR x-curator-slug + x-curator-whatsapp headers',
  });
}

// ── POST /api/looks — create a look ──
router.post('/', lookAuth, async (req, res) => {
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
        agentAddress: req.creatorAddress,
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
      agentAddress: req.creatorAddress,
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

    // Resolve hero listing image + cover image for each look so the
    // /looks page can render thumbnails without a second round-trip.
    // Collect all unique listing IDs to resolve in a single query.
    const allListingIds = [...new Set(
      looks.flatMap((l) => l.listingIds || []),
    )];

    let listingMap = new Map();
    if (allListingIds.length > 0) {
      const rows = await db
        .select()
        .from(listings)
        .where(inArray(listings.id, allListingIds));
      listingMap = new Map(rows.map((r) => [r.id, r]));
    }

    const looksWithImages = looks.map((look) => {
      const heroId = look.heroListingId || look.listingIds?.[0];
      const heroListing = heroId ? listingMap.get(heroId) : null;
      const heroImageUrl = heroListing ? listingImageUrl(heroListing) : null;

      return {
        ...look,
        coverImageUrl: look.coverImageKey ? r2PublicUrl(look.coverImageKey) : null,
        heroImageUrl,
        // Include a minimal items array so the frontend's fallback logic works
        items: (look.listingIds || []).map((id) => {
          const listing = listingMap.get(id);
          return {
            id,
            title: listing?.title || 'Item',
            curatorSlug: look.curatorSlug,
            imageUrl: listing ? listingImageUrl(listing) : null,
            isHero: id === look.heroListingId,
          };
        }),
      };
    });

    res.json({ looks: looksWithImages, count: looksWithImages.length });
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
router.patch('/:slug', lookAuth, async (req, res) => {
  try {
    const db = getDb();

    const [existing] = await db
      .select()
      .from(agentLooks)
      .where(eq(agentLooks.slug, req.params.slug))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'Look not found' });
    if (existing.agentAddress !== req.creatorAddress) {
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
router.post('/:slug/image', lookAuth, async (req, res) => {
  try {
    const db = getDb();

    const [existing] = await db
      .select()
      .from(agentLooks)
      .where(eq(agentLooks.slug, req.params.slug))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'Look not found' });
    if (existing.agentAddress !== req.creatorAddress) {
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

// ── POST /api/looks/curator/:slug/link-agent — set linkedAgentAddress (curator auth) ──
// A curator links an agent wallet so that agent's looks appear on their storefront.
// They can also set this to their own wallet to create looks themselves.
router.post('/curator/:slug/link-agent', async (req, res) => {
  try {
    const { slug } = req.params;
    const { whatsapp, agentAddress } = req.body;

    if (!whatsapp || !agentAddress) {
      return res.status(400).json({ error: 'whatsapp and agentAddress are required' });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(agentAddress)) {
      return res.status(400).json({ error: 'agentAddress must be a valid 0x address' });
    }

    const db = getDb();
    const [curator] = await db
      .select()
      .from(curators)
      .where(eq(curators.slug, slug))
      .limit(1);

    if (!curator) return res.status(404).json({ error: 'Curator not found' });

    // WhatsApp verification
    const storedWhatsapp = String(curator.channels?.whatsapp || '').replace(/\s/g, '');
    const providedWhatsapp = String(whatsapp).replace(/\s/g, '');
    if (!storedWhatsapp || storedWhatsapp !== providedWhatsapp) {
      return res.status(401).json({ error: 'WhatsApp verification failed' });
    }

    await db
      .update(curators)
      .set({ linkedAgentAddress: agentAddress })
      .where(eq(curators.slug, slug));

    logger.info('Linked agent address set', {
      component: 'agent-looks',
      curatorSlug: slug,
      agentAddress,
    });

    res.json({ success: true, slug, linkedAgentAddress: agentAddress });
  } catch (err) {
    logger.error('Failed to link agent', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to link agent' });
  }
});

module.exports = router;
