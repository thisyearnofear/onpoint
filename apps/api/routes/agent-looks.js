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
 * Auth (creator-scoped writes):
 *   Signature-verified wallet session via /api/auth/challenge + /api/auth/verify,
 *   sent as `Authorization: Bearer <token>` (or x-agent-session). Optional
 *   x-curator-slug binds curator context when the signed wallet belongs to that
 *   curator. A bare x-agent-address header is only used for public reads and
 *   share attribution — never as an identity proof for writes.
 *
 * Routes:
 *   POST   /api/looks              — create a look (agent or curator auth)
 *   GET    /api/looks              — list looks (public, filterable)
 *   GET    /api/looks/:slug        — get a look with resolved listings (public)
 *   PATCH  /api/looks/:slug        — update a look (creator only)
 *   DELETE /api/looks/:slug        — archive a look (creator only)
 *   POST   /api/looks/:slug/image  — upload cover image (creator only)
 *   POST   /api/looks/:slug/share  — record a share event (public, increments count; body: shareId, channel)
 *   POST   /api/looks/:slug/visit  — record a landing on the look page (public; body: shareId, channel)
 *   POST   /api/looks/:slug/storefront — record a storefront step reached from a look (public; body: kind, shareId)
 *   POST   /api/looks/:slug/cta    — record a try-on/shop CTA click (public; body: kind, shareId, channel)
 *   POST   /api/looks/:slug/collage — generate/regenerate look collage (public)
 *   POST   /api/looks/:slug/classify — auto-classify look metadata (public)
 *   POST   /api/looks/curator/:slug/link-agent — set linkedAgentAddress (curator auth)
 */

const express = require('express');
const { eq, and, desc, sql, ilike, inArray } = require('drizzle-orm');
const { agentLooks, listings, curators, kitSkus } = require('@repo/db');
const { upload: r2Upload } = require('@repo/storage');
const logger = require('../lib/logger');
const { getDb } = require('../lib/db');
const { slugify } = require('../lib/slugs');
const { keyToUrl, listingImageUrl } = require('../lib/r2');
const { webBaseUrl } = require('../lib/agent-commerce');
const { composeLookCollage, composeLookCollageAI } = require('../lib/image-composite');
const { removeBackground } = require('../lib/image-processing');
const { classifyLook } = require('../lib/look-classify');
const { logFunnelEvent } = require('../lib/funnel');
const { deriveReferralCode } = require('../lib/referral-codes');
const {
  newShareId,
  sanitizeShareId,
  sanitizeChannel,
  sanitizeCtaKind,
  sanitizeStorefrontKind,
  hashVisitor,
} = require('../lib/share-attribution');
const { requireAgentSession, extractSessionToken } = require('../middleware/agent-session');
const { verifySessionToken } = require('../lib/agent-session');
const {
  OTP_TTL_SECONDS,
  generateOtp,
  hashOtp,
  verifyOtpFormat,
  timingSafeStringEqual,
  normalizePhone,
  createMemoryLinkOtpStore,
  createRedisLinkOtpStore,
} = require('../lib/link-agent-otp');

// OTP store singleton: Redis in production when available, memory otherwise.
// Tests can override via router._setLinkOtpStore(store).
let _linkOtpStore = null;
function getLinkOtpStore() {
  if (_linkOtpStore) return _linkOtpStore;
  try {
    const { getRedis } = require('../lib/redis');
    const redis = getRedis();
    if (redis && process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
      _linkOtpStore = createRedisLinkOtpStore(redis);
      return _linkOtpStore;
    }
  } catch {
    // fall through to memory
  }
  _linkOtpStore = createMemoryLinkOtpStore();
  return _linkOtpStore;
}

const router = express.Router();

const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

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

// ── Auth middleware: verified wallet session (agent or curator) ──
// Both paths require a signature-verified session token from /api/auth/verify.
// Curator context (x-curator-slug) is bound by checking that the signed wallet
// belongs to that curator — a plaintext WhatsApp number is no longer an auth
// factor. A bare x-agent-address header is rejected for writes.
async function lookAuth(req, res, next) {
  requireAgentSession(req, res, async () => {
    const address = req.agentSession.sub;
    const curatorSlug = req.headers['x-curator-slug'];

    if (curatorSlug) {
      try {
        const db = getDb();
        const [curator] = await db
          .select()
          .from(curators)
          .where(eq(curators.slug, curatorSlug))
          .limit(1);

        if (!curator) {
          return res.status(404).json({ error: 'Curator not found' });
        }

        const curatorWallets = [
          curator.linkedAgentAddress,
          curator.commerce?.walletAddress,
          curator.commerce?.custodialWalletAddress,
        ]
          .filter(Boolean)
          .map((w) => String(w).toLowerCase());

        if (!curatorWallets.includes(address)) {
          return res.status(403).json({
            error: 'Authenticated wallet is not linked to this curator',
            hint: 'Sign in with the curator payout wallet or the linked agent wallet (see /api/auth/challenge).',
          });
        }

        req.creatorAddress = address;
        req.creatorType = 'curator';
        req.curatorSlug = curatorSlug;
        return next();
      } catch (err) {
        logger.error('Curator session binding failed', { component: 'agent-looks' }, err);
        return res.status(500).json({ error: 'Auth failed' });
      }
    }

    req.creatorAddress = address;
    req.creatorType = 'agent';
    return next();
  });
}

// ── POST /api/looks — create a look ──
router.post('/', lookAuth, async (req, res) => {
  try {
    const db = getDb();
    const { title, description, listingIds, heroListingId, curatorSlug, tags, coverImage, status } = req.body;

    if (!title || !listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return res.status(400).json({ error: 'title and listingIds[] are required' });
    }

    // Validate status if provided — must be one of the allowed enum values
    const allowedStatuses = ['live', 'paused', 'archived', 'draft'];
    const lookStatus = status && allowedStatuses.includes(status) ? status : 'live';

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
        curatorSlug: req.curatorSlug || curatorSlug || null,
        coverImageKey,
        tags: tags || [],
        status: lookStatus,
        provenance: req.creatorType === 'curator' ? 'curator' : 'studio',
      })
      .returning();

    logger.info('Look created', {
      component: 'agent-looks',
      slug,
      agentAddress: req.creatorAddress,
      listingCount: listingIds.length,
    });

    // Fire-and-forget collage generation + auto-classification —
    // non-blocking, best-effort. The look works without either (falls
    // back to coverImageUrl → heroImageUrl, and metadata defaults to {}).
    setImmediate(async () => {
      try {
        const resolved = await resolveListings(db, look.listingIds);
        const collageItems = resolved
          .map(({ listing, kit }) => {
            const imageUrl = listingImageUrl(listing);
            if (!imageUrl) return null;
            return {
              imageUrl,
              title: listing.title || (kit ? `${kit.club} ${kit.kitType}` : 'Item'),
              isHero: listing.id === look.heroListingId,
            };
          })
          .filter(Boolean);

        // Auto-classify the look (category, occasion, season)
        if (collageItems.length > 0) {
          try {
            const metadata = await classifyLook({
              tags: tags || [],
              items: collageItems,
              lookTitle: look.title,
            });
            await db
              .update(agentLooks)
              .set({ metadata, updatedAt: new Date() })
              .where(eq(agentLooks.slug, slug));
            logger.info('Auto-classified look', { component: 'agent-looks', slug, metadata });
          } catch {
            // Non-fatal — metadata defaults to {}
          }

          // Generate collage (Tier 2 AI if a vision client is available, else Tier 1 sharp)
          let qwenClient = null;
          if (!process.env.QWEN_CLOUD_KILL_SWITCH) {
            try {
              const client = require('@repo/qwen-cloud').getPrimaryAiClient();
              if (client && await client.isAvailable()) {
                qwenClient = client;
              }
            } catch {
              // Non-fatal — Tier 1 fallback
            }
          }

          await composeLookCollageAI({
            items: collageItems,
            lookTitle: look.title,
            agentAddress: look.agentAddress,
            lookSlug: look.slug,
            curatorSlug: look.curatorSlug,
            qwenClient,
          });
          logger.info('Auto-generated collage for look', { component: 'agent-looks', slug });
        }
      } catch {
        // Non-fatal — collage can be regenerated on demand
      }
    });

    res.status(201).json(look);
  } catch (err) {
    logger.error('Failed to create look', { component: 'agent-looks' }, err);
    res.status(500).json({ error: err.message?.slice(0, 200) || 'Failed to create look' });
  }
});

// ── GET /api/looks — list looks (public) ──
// Public requests can only see live looks. Creators with a verified wallet
// session can pass ?status=draft (or other non-live values) to see their own
// looks in that status.
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { curator, tag, agent, limit, category, occasion, season, status } = req.query;
    const lim = Math.min(parseInt(limit) || 20, 100);

    // Resolve the requester's creator address from a verified wallet session
    // (best-effort). Gates non-live status queries to the creator's own looks;
    // unauthenticated or header-only requests stay public (live-only).
    let requesterAddress = null;
    const sessionPayload = verifySessionToken(extractSessionToken(req));
    if (sessionPayload) {
      requesterAddress = sessionPayload.sub;
    }

    // Determine the status filter.
    // - Public requests (no auth): only 'live'
    // - Authenticated creators requesting a non-live status: that status,
    //   scoped to their own looks
    const requestedStatus = typeof status === 'string' ? status : null;
    let statusFilter = 'live';
    let scopeToCreator = false;
    if (requestedStatus && requestedStatus !== 'live' && requesterAddress) {
      statusFilter = requestedStatus;
      scopeToCreator = true;
    }

    const conditions = [eq(agentLooks.status, statusFilter)];
    if (scopeToCreator) conditions.push(sql`lower(${agentLooks.agentAddress}) = ${requesterAddress}`);
    if (curator) conditions.push(eq(agentLooks.curatorSlug, curator));
    if (agent) conditions.push(eq(agentLooks.agentAddress, agent));
    if (tag) conditions.push(sql`${agentLooks.tags} @> ARRAY[${tag}]::text[]`);
    if (category) conditions.push(sql`${agentLooks.metadata}->>'category' = ${category}`);
    if (occasion) conditions.push(sql`${agentLooks.metadata}->>'occasion' = ${occasion}`);
    if (season) conditions.push(sql`${agentLooks.metadata}->>'season' = ${season}`);

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
      const coverImageUrl = look.coverImageKey ? keyToUrl(look.coverImageKey) : null;

      return {
        ...look,
        coverImageUrl,
        heroImageUrl,
        // Collage URL: check if a collage exists in R2, otherwise fall back
        // to coverImageUrl → heroImageUrl. The frontend uses this as the
        // primary card image when available.
        collageUrl: keyToUrl(`looks/${look.slug}/collage-latest.webp`) || coverImageUrl || heroImageUrl,
        provenance: look.provenance,
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

// ── POST /api/looks/bulk — bulk action on multiple looks (creator only) ──
// Applies an action (archive | publish | delete) to multiple slugs. The
// requester must be the creator of each look — slugs owned by others are
// reported as failures rather than applied.
router.post('/bulk', lookAuth, async (req, res) => {
  try {
    const db = getDb();
    const { action, slugs } = req.body;

    if (!action || !['archive', 'publish', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'action must be one of: archive, publish, delete' });
    }
    if (!slugs || !Array.isArray(slugs) || slugs.length === 0) {
      return res.status(400).json({ error: 'slugs[] is required' });
    }

    let updated = 0;
    const failed = [];

    for (const slug of slugs) {
      try {
        const [existing] = await db
          .select()
          .from(agentLooks)
          .where(eq(agentLooks.slug, slug))
          .limit(1);

        if (!existing) {
          failed.push({ slug, error: 'Look not found' });
          continue;
        }
        if ((existing.agentAddress || '').toLowerCase() !== req.creatorAddress) {
          failed.push({ slug, error: 'Not the look owner' });
          continue;
        }

        if (action === 'delete') {
          await db
            .delete(agentLooks)
            .where(eq(agentLooks.slug, slug));
        } else if (action === 'archive') {
          await db
            .update(agentLooks)
            .set({ status: 'archived', updatedAt: new Date() })
            .where(eq(agentLooks.slug, slug));
        } else if (action === 'publish') {
          await db
            .update(agentLooks)
            .set({ status: 'live', updatedAt: new Date() })
            .where(eq(agentLooks.slug, slug));
        }
        updated += 1;
      } catch (err) {
        failed.push({ slug, error: err.message?.slice(0, 120) || 'Failed to apply action' });
      }
    }

    logger.info('Bulk look action', {
      component: 'agent-looks',
      action,
      updated,
      failed: failed.length,
      requester: req.creatorAddress,
    });

    res.json({ updated, failed });
  } catch (err) {
    logger.error('Failed bulk action', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to apply bulk action' });
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
    const referralCode = deriveReferralCode(look.agentAddress);
    const coverImageUrl = look.coverImageKey ? keyToUrl(look.coverImageKey) : null;

    res.json({
      ...look,
      coverImageUrl,
      collageUrl: keyToUrl(`looks/${look.slug}/collage-latest.webp`) || coverImageUrl,
      provenance: look.provenance,
      items,
      referralCode,
      shareUrl: `${webBaseUrl()}/look/${look.slug}`,
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
    if ((existing.agentAddress || '').toLowerCase() !== req.creatorAddress) {
      return res.status(403).json({
        error: 'Not the look owner',
        provided: req.creatorAddress || 'not provided',
        expected: existing.agentAddress,
        hint: 'Sign in via /api/auth/challenge + /api/auth/verify with the wallet that created this look, then send Authorization: Bearer <token>.',
      });
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

// ── DELETE /api/looks/:slug — delete a look (owner only) ──
router.delete('/:slug', lookAuth, async (req, res) => {
  try {
    const db = getDb();

    const [existing] = await db
      .select()
      .from(agentLooks)
      .where(eq(agentLooks.slug, req.params.slug))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'Look not found' });
    if ((existing.agentAddress || '').toLowerCase() !== req.creatorAddress) {
      return res.status(403).json({
        error: 'Not the look owner',
        provided: req.creatorAddress || 'not provided',
        expected: existing.agentAddress,
        hint: 'Sign in via /api/auth/challenge + /api/auth/verify with the wallet that created this look, then send Authorization: Bearer <token>.',
      });
    }

    await db
      .delete(agentLooks)
      .where(eq(agentLooks.slug, req.params.slug));

    logger.info('Look deleted', {
      component: 'agent-looks',
      slug: req.params.slug,
      agentAddress: req.creatorAddress,
    });

    res.json({ success: true, slug: req.params.slug });
  } catch (err) {
    logger.error('Failed to delete look', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to delete look' });
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
    if ((existing.agentAddress || '').toLowerCase() !== req.creatorAddress) {
      return res.status(403).json({
        error: 'Not the look owner',
        provided: req.creatorAddress || 'not provided',
        expected: existing.agentAddress,
        hint: 'Sign in via /api/auth/challenge + /api/auth/verify with the wallet that created this look, then send Authorization: Bearer <token>.',
      });
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

    res.json({ coverImageKey: key, coverImageUrl: keyToUrl(key) });
  } catch (err) {
    logger.error('Failed to upload look image', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ── Share-loop events (docs/ops/growth-loop.md) ──
// Stored in funnel_events: look_share | look_visit | look_cta. No raw IP/UA is
// stored; visitors are identified by a salted, day-scoped hash.
async function isLiveLook(db, slug) {
  const rows = await db.execute(sql`
    SELECT 1 FROM agent_looks WHERE slug = ${slug} AND status = 'live' LIMIT 1
  `);
  return (rows.rows || rows).length > 0;
}

function recordLookEvent(db, req, eventType, extra = {}) {
  const body = req.body || {};
  const shareId = sanitizeShareId(body.shareId);
  const agent = typeof req.headers['x-agent-address'] === 'string' ? req.headers['x-agent-address'] : null;
  logFunnelEvent(db, {
    eventType,
    source: agent ? 'agent' : 'web',
    payerAddress: agent,
    visitorHash: hashVisitor(req.ip, req.headers['user-agent']),
    metadata: {
      lookSlug: req.params.slug,
      shareId,
      channel: sanitizeChannel(body.channel),
      ...extra,
    },
  });
  return shareId;
}

// ── POST /api/looks/:slug/share — record a share event ──
// Body (all optional): { shareId, channel }. The client mints shareId so the
// share URL can be built synchronously inside the user gesture.
router.post('/:slug/share', async (req, res) => {
  try {
    const db = getDb();
    if (!(await isLiveLook(db, req.params.slug))) {
      return res.status(404).json({ error: 'Look not found' });
    }

    await db.execute(sql`
      UPDATE agent_looks
      SET share_count = share_count + 1, updated_at = now()
      WHERE slug = ${req.params.slug} AND status = 'live'
    `);

    const shareId = sanitizeShareId((req.body || {}).shareId) || newShareId();
    recordLookEvent(db, req, 'look_share', { shareId });
    res.json({ success: true, shareId });
  } catch (err) {
    logger.error('Failed to record share', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

// ── POST /api/looks/:slug/visit — landing on a (shared) look page ──
// Body: { shareId?, channel? }. Only attributed visits (valid shareId) count
// toward the share funnel; plain visits are still logged with shareId=null.
router.post('/:slug/visit', async (req, res) => {
  try {
    const db = getDb();
    if (!(await isLiveLook(db, req.params.slug))) {
      return res.status(404).json({ error: 'Look not found' });
    }
    recordLookEvent(db, req, 'look_visit');
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to record look visit', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to record visit' });
  }
});

// ── POST /api/looks/:slug/storefront — step reached on the curator storefront ──
// Body: { kind: 'arrive' | 'tryon' | 'buy' | 'order', shareId, channel? }.
// Only shareId-carrying events are used by the share funnel.
router.post('/:slug/storefront', async (req, res) => {
  try {
    const kind = sanitizeStorefrontKind((req.body || {}).kind);
    if (!kind) return res.status(400).json({ error: "kind must be 'arrive', 'tryon', 'buy' or 'order'" });
    const db = getDb();
    if (!(await isLiveLook(db, req.params.slug))) {
      return res.status(404).json({ error: 'Look not found' });
    }
    recordLookEvent(db, req, 'look_storefront', { kind });
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to record storefront event', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to record storefront event' });
  }
});

// ── POST /api/looks/:slug/cta — clicked "Try it on" / "Shop the pieces" ──
// Body: { kind: 'tryon' | 'shop', shareId?, channel? }
router.post('/:slug/cta', async (req, res) => {
  try {
    const kind = sanitizeCtaKind((req.body || {}).kind);
    if (!kind) return res.status(400).json({ error: "kind must be 'tryon' or 'shop'" });
    const db = getDb();
    if (!(await isLiveLook(db, req.params.slug))) {
      return res.status(404).json({ error: 'Look not found' });
    }
    recordLookEvent(db, req, 'look_cta', { kind });
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to record look cta', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to record cta' });
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

// ── POST /api/looks/:slug/collage — generate (or regenerate) the look collage ──
// Public endpoint — generates a sharp-based collage from item images and
// stores it in R2. Optionally removes backgrounds from item images first
// (if REPLICATE_API_TOKEN is configured). The collage is cached in R2
// and served on subsequent list/detail requests via the collageUrl field.
router.post('/:slug/collage', async (req, res) => {
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

    // Resolve listings for item images
    const resolvedListings = await resolveListings(db, look.listingIds);
    if (resolvedListings.length === 0) {
      return res.status(400).json({ error: 'Look has no items to collage' });
    }

    // Build items array for the collage composer
    const items = [];
    for (const { listing, kit } of resolvedListings) {
      const imageUrl = listingImageUrl(listing);
      if (!imageUrl) continue;

      // Best-effort background removal (Tier 2: Replicate, Tier 3: null)
      // This is optional — the collage looks good with or without cutouts.
      let cutoutUrl = null;
      try {
        cutoutUrl = await removeBackground(
          imageUrl,
          `listings/${listing.id}/cutout.png`,
        );
      } catch {
        // Non-fatal — collage uses original image
      }

      items.push({
        imageUrl,
        cutoutUrl,
        title: listing.title || (kit ? `${kit.club} ${kit.kitType}` : 'Item'),
        isHero: listing.id === look.heroListingId,
      });
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'No item images available for collage' });
    }

    // Generate the collage.
    //
    // Tier 2 (AI): If Qwen Cloud is available and not kill-switched, try
    //   composeLookCollageAI first — it uses wan2.7-image-pro to generate
    //   a styled editorial flat-lay from the item images. This is best-effort;
    //   any failure (network, spend guard, model error) falls back to Tier 1.
    //
    // Tier 1 (sharp): Deterministic grid composition — always works, no AI
    //   dependency. composeLookCollageAI handles this fallback internally.
    let qwenClient = null;
    if (!process.env.QWEN_CLOUD_KILL_SWITCH) {
      try {
        const client = require('@repo/qwen-cloud').getPrimaryAiClient();
        if (client && await client.isAvailable()) {
          qwenClient = client;
        }
      } catch {
        // AI client package not available or misconfigured — use Tier 1.
      }
    }

    const result = await composeLookCollageAI({
      items,
      lookTitle: look.title,
      agentAddress: look.agentAddress,
      lookSlug: look.slug,
      curatorSlug: look.curatorSlug,
      qwenClient,
    });

    logger.info('Look collage generated', {
      component: 'agent-looks',
      slug: look.slug,
      r2Key: result.r2Key,
      tier: result.tier,
      ...(result.aiFallbackReason ? { aiFallbackReason: result.aiFallbackReason } : {}),
    });

    res.json({
      success: true,
      collageUrl: result.url,
      r2Key: result.r2Key,
      tier: result.tier,
      ...(result.aiFallbackReason ? { aiFallbackReason: result.aiFallbackReason } : {}),
    });
  } catch (err) {
    logger.error('Failed to generate collage', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to generate collage' });
  }
});

// ── POST /api/looks/:slug/classify — auto-classify look (category, occasion, season) ──
// Public endpoint — runs AI classification (or rule-based fallback) and
// stores the result in agent_looks.metadata. Can be called on-demand
// to reclassify a look after tag changes.
router.post('/:slug/classify', async (req, res) => {
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

    const resolvedListings = await resolveListings(db, look.listingIds);
    const items = resolvedListings.map(({ listing, kit }) => ({
      imageUrl: listingImageUrl(listing),
      title: listing.title || (kit ? `${kit.club} ${kit.kitType}` : 'Item'),
      isHero: listing.id === look.heroListingId,
    })).filter((i) => i.imageUrl);

    const metadata = await classifyLook({
      tags: look.tags || [],
      items,
      lookTitle: look.title,
    });

    await db
      .update(agentLooks)
      .set({ metadata, updatedAt: new Date() })
      .where(eq(agentLooks.slug, look.slug));

    logger.info('Look classified', { component: 'agent-looks', slug: look.slug, metadata });

    res.json({ success: true, metadata });
  } catch (err) {
    logger.error('Failed to classify look', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to classify look' });
  }
});

// ── Link-agent two-sided consent (closes the phone-as-password hole) ──
// The legacy route treated a guessable WhatsApp number as a credential and
// let anyone overwrite linkedAgentAddress (permanent attribution redirect).
// New flow:
//   POST .../link-agent/request — curator owner session → OTP to stored number
//   POST .../link-agent/verify  — curator owner session + OTP + agent session
// Both sides sign: curator proves wallet + phone, agent proves wallet.
function curatorOwnerWallets(curator) {
  return [
    curator.commerce?.walletAddress,
    curator.commerce?.custodialWalletAddress,
  ]
    .filter(Boolean)
    .map((w) => String(w).toLowerCase());
}

async function requireCuratorOwner(req, res) {
  const address = req.agentSession?.sub;
  const slug = req.params.slug;
  if (!address) {
    res.status(401).json({ error: 'Wallet session required', code: 'SESSION_REQUIRED' });
    return null;
  }
  const db = getDb();
  const [curator] = await db.select().from(curators).where(eq(curators.slug, slug)).limit(1);
  if (!curator) {
    res.status(404).json({ error: 'Curator not found' });
    return null;
  }
  const owners = curatorOwnerWallets(curator);
  if (!owners.includes(String(address).toLowerCase())) {
    res.status(403).json({
      error: 'Authenticated wallet is not the curator payout wallet',
      hint: 'Sign in with the curator payout wallet to manage agent linking.',
    });
    return null;
  }
  return curator;
}

// POST /api/looks/curator/:slug/link-agent/request — send OTP to stored number
router.post('/curator/:slug/link-agent/request', requireAgentSession, async (req, res) => {
  try {
    const curator = await requireCuratorOwner(req, res);
    if (!curator) return;
    const storedWhatsapp = normalizePhone(curator.channels?.whatsapp || '');
    if (!storedWhatsapp) {
      return res.status(400).json({ error: 'Curator has no WhatsApp number on file' });
    }
    const store = getLinkOtpStore();
    const { allowed, remaining } = await store.canSend(storedWhatsapp);
    logger.info('Link-agent OTP requested', {
      component: 'agent-looks',
      curatorSlug: curator.slug,
      actor: req.agentSession.sub,
      allowed,
    });
    if (!allowed) {
      return res.status(429).json({ error: 'Too many OTP sends — try again in an hour', retryAfter: 3600, remaining });
    }
    const otp = generateOtp();
    await store.saveOtp(curator.slug, hashOtp(otp), OTP_TTL_SECONDS);
    await store.recordSend(storedWhatsapp);
    try {
      const { sendMessage } = require('../lib/linq-client');
      await sendMessage({
        to: storedWhatsapp,
        text: `OnPoint agent link code: ${otp}. Valid 10 minutes. Never share this code — only enter it on your storefront to link an agent wallet.`,
      });
    } catch (sendErr) {
      logger.error('Link-agent OTP send failed', { component: 'agent-looks' }, sendErr);
      return res.status(503).json({ error: 'Failed to send OTP — try again' });
    }
    res.json({ success: true, sent: true, expiresInSeconds: OTP_TTL_SECONDS });
  } catch (err) {
    logger.error('Failed to request link OTP', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to request link code' });
  }
});

// POST /api/looks/curator/:slug/link-agent/verify — { otp, agentAddress, agentToken }
router.post('/curator/:slug/link-agent/verify', requireAgentSession, async (req, res) => {
  try {
    const curator = await requireCuratorOwner(req, res);
    if (!curator) return;
    const { otp, agentAddress, agentToken } = req.body || {};
    if (!otp || !agentAddress || !agentToken) {
      return res.status(400).json({ error: 'otp, agentAddress and agentToken are required' });
    }
    if (!verifyOtpFormat(String(otp))) {
      return res.status(400).json({ error: 'otp must be a 6-digit code' });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(String(agentAddress))) {
      return res.status(400).json({ error: 'agentAddress must be a valid 0x address' });
    }
    // Agent-side consent: token must be a valid session for the linked address.
    const agentPayload = verifySessionToken(String(agentToken));
    if (!agentPayload || agentPayload.sub !== String(agentAddress).toLowerCase()) {
      logger.info('Link-agent verify rejected: agent consent invalid', {
        component: 'agent-looks',
        curatorSlug: curator.slug,
        actor: req.agentSession.sub,
      });
      return res.status(403).json({
        error: 'Agent consent invalid — the agent must sign in and provide their own session token',
        hint: 'Agent: POST /api/auth/challenge { address } → sign → POST /api/auth/verify → pass token as agentToken.',
      });
    }
    const store = getLinkOtpStore();
    const record = await store.getOtp(curator.slug);
    if (!record) {
      return res.status(401).json({ error: 'No active link code — request a new one', code: 'OTP_NOT_FOUND' });
    }
    const expected = String(record.hash);
    let supplied;
    try {
      supplied = hashOtp(String(otp));
    } catch {
      return res.status(500).json({ error: 'OTP verification not configured on server' });
    }
    if (!timingSafeStringEqual(supplied, expected)) {
      const attempt = await store.consumeAttempt(curator.slug);
      logger.info('Link-agent OTP mismatch', {
        component: 'agent-looks',
        curatorSlug: curator.slug,
        actor: req.agentSession.sub,
        locked: attempt?.locked || false,
      });
      if (attempt?.locked) {
        return res.status(401).json({ error: 'Too many wrong codes — request a new one', code: 'OTP_LOCKED' });
      }
      return res.status(401).json({ error: 'Wrong link code', code: 'OTP_MISMATCH' });
    }
    await store.clearOtp(curator.slug);
    const from = curator.linkedAgentAddress || null;
    const db = getDb();
    await db.update(curators).set({ linkedAgentAddress: agentAddress }).where(eq(curators.slug, curator.slug));
    // Audit trail (structured log; curator_link_events table once migrations exist).
    logger.info('Linked agent address changed', {
      component: 'agent-looks',
      curatorSlug: curator.slug,
      from,
      to: agentAddress,
      curatorActor: req.agentSession.sub,
      agentConsented: agentPayload.sub,
      method: 'otp+two-sided-session',
    });
    res.json({ success: true, slug: curator.slug, linkedAgentAddress: agentAddress, previous: from });
  } catch (err) {
    logger.error('Failed to verify link agent', { component: 'agent-looks' }, err);
    res.status(500).json({ error: 'Failed to link agent' });
  }
});

// Legacy route: closed. Plaintext WhatsApp is no longer a credential.
router.post('/curator/:slug/link-agent', (req, res) => {
  return res.status(410).json({
    error: 'link-agent now requires two-sided consent (OTP + wallet sessions)',
    hint: 'POST .../link-agent/request (curator session) → enter OTP → POST .../link-agent/verify { otp, agentAddress, agentToken }.',
  });
});

// Test hook: override the OTP store (memory) for contract tests.
router._setLinkOtpStore = (store) => {
  _linkOtpStore = store;
};
router._getLinkOtpStore = getLinkOtpStore;

module.exports = router;
