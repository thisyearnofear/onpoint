/**
 * Pair Card Routes — /api/pair
 *
 * "Same fit, both of us": one person uploads their photo + a garment
 * (catalog listing or a photo of the clothing), gets a try-on render, and
 * sends an unguessable link. The recipient uploads their photo — optionally
 * a different garment for the swap — and the two renders composite into a
 * shareable pair card at /pair/{id}.
 *
 *   POST /api/pair            { personPhotoData, listingId?|garmentPhotoData?, caption?, senderName?, replyTo? }
 *   GET  /api/pair/:id        → public pair state (no photos, renders + card only)
 *   POST /api/pair/:id/join   { personPhotoData, recipientName?, listingId?|garmentPhotoData? }
 *
 * Renders run the shared try-on engine (routes/ai-virtual-tryon.js). The
 * tier is PAIR_RENDER_TIER (default 'paid' — garment-conditioned providers;
 * 'free' produces unconditioned AI fashion photos and defeats the point).
 * Each render costs provider money, so POSTs sit behind the API key +
 * expensive-AI rate limits; only GET /:id is public.
 */

const express = require('express');
const crypto = require('crypto');
const { eq } = require('drizzle-orm');
const { pairCards, listings } = require('@repo/db');
const { getDb } = require('../lib/db');
const Redis = require('ioredis');
const { createRateLimiter } = require('../middleware/rate-limit');
const { createApiKeyAuth } = require('../middleware/api-key-auth');
const { keyToUrl } = require('../lib/r2');
const { upload: r2Upload, publicUrl: r2PublicUrl } = require('@repo/storage');
const { composePairCard } = require('../lib/image-composite');
const { ensureDataUri } = require('../lib/image-data-uri');
const { engine } = require('./ai-virtual-tryon');
const { logFunnelEvent } = require('../lib/funnel');
const { sanitizeShareId } = require('../lib/share-attribution');
const logger = require('../lib/logger');

const router = express.Router();
const ID_RE = /^[a-f0-9-]{36}$/;
const PHOTO_BYTES_MAX = 8_000_000; // ~6 MB image as base64

const isTestEnv = process.env.NODE_ENV === 'test';
const passThrough = (req, res, next) => next();
const pairRedis = isTestEnv
  ? null
  : new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
if (pairRedis) {
  pairRedis.on('error', (err) => {
    console.error('[Redis] pair route connection error:', err.message);
  });
}
const aiAuth = createApiKeyAuth();
const expensiveRateLimit = isTestEnv ? passThrough : createRateLimiter(pairRedis, 'aiExpensive');
const expensiveDailyLimit = isTestEnv ? passThrough : createRateLimiter(pairRedis, 'aiExpensiveDaily');
const generalLimit = isTestEnv ? passThrough : createRateLimiter(pairRedis, 'general');

const renderTier = () => process.env.PAIR_RENDER_TIER || 'paid';
const webBase = () => process.env.WEB_BASE_URL || 'https://onpoint.trustfall.xyz';

function isPhotoData(v) {
  return typeof v === 'string' && v.startsWith('data:image/') && v.length <= PHOTO_BYTES_MAX;
}

async function uploadImageDataUri(dataUri, prefix) {
  const match = String(dataUri).match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const key = `${prefix}/${crypto.randomUUID()}.${ext}`;
  await r2Upload(key, Buffer.from(match[2], 'base64'), `image/${ext}`);
  return r2PublicUrl(key);
}

/**
 * Resolve the shared garment: a live catalog listing wins over an uploaded
 * garment photo. Returns { kind, listingId?, curatorSlug?, title, imageUrl }.
 */
async function resolveGarment(db, { listingId, garmentPhotoData }) {
  if (listingId) {
    const [row] = await db.select().from(listings).where(eq(listings.id, String(listingId))).limit(1);
    if (row) {
      const imageUrl = row.photoKeys?.[0] ? keyToUrl(row.photoKeys[0]) : null;
      if (imageUrl) {
        return {
          kind: 'listing',
          listingId: row.id,
          curatorSlug: row.curatorSlug || null,
          title: row.title || 'the shared piece',
          imageUrl,
        };
      }
    }
  }
  if (isPhotoData(garmentPhotoData)) {
    const imageUrl = await uploadImageDataUri(garmentPhotoData, 'pair-cards/garments');
    if (imageUrl) {
      return { kind: 'photo', title: 'their find', imageUrl };
    }
  }
  return null;
}

/** Run the try-on engine for one person and persist the render to R2. */
async function runPairRender({ pairId, side, photoData, garment }) {
  const result = await engine.buildGeneratedOutfitImageResponse({
    data: {
      photoData,
      personDescription: '',
      garmentCategory: 'auto',
      items: [{ name: garment.title, imageUrl: garment.imageUrl, description: garment.title }],
    },
    provider: 'auto',
    tier: renderTier(),
  });
  if (!result?.generatedImage) throw new Error('try-on render produced no image');
  const dataUri = await ensureDataUri(result.generatedImage);
  const buffer = Buffer.from(dataUri.split(',')[1], 'base64');
  const ext = dataUri.startsWith('data:image/png') ? 'png' : 'jpg';
  const key = `pair-cards/${pairId}/${side}.${ext}`;
  await r2Upload(key, buffer, ext === 'png' ? 'image/png' : 'image/jpeg');
  return { imageUrl: r2PublicUrl(key), provider: result.provider, imageConditioned: result.imageConditioned };
}

async function publicView(row) {
  return {
    id: row.id,
    status: row.status,
    caption: row.caption,
    senderName: row.senderName,
    recipientName: row.recipientName,
    garment: row.garment,
    senderRenderUrl: row.senderRenderUrl,
    recipientRenderUrl: row.recipientRenderUrl,
    cardUrl: row.cardUrl,
    replyTo: row.replyTo,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

// ── Create: sender's half ──────────────────────────────────────────
router.post('/', aiAuth, expensiveRateLimit, expensiveDailyLimit, async (req, res) => {
  try {
    const { personPhotoData, listingId, garmentPhotoData, caption, senderName, replyTo, shareId, shareChannel } = req.body || {};
    if (!isPhotoData(personPhotoData)) {
      return res.status(400).json({ error: 'personPhotoData (data:image/..., under 6 MB) required' });
    }
    const db = getDb();
    const garment = await resolveGarment(db, { listingId, garmentPhotoData });
    if (!garment) {
      return res.status(400).json({ error: 'a garment is required — listingId or garmentPhotoData' });
    }

    const [row] = await db
      .insert(pairCards)
      .values({
        garment,
        caption: caption ? String(caption).slice(0, 80) : null,
        senderName: senderName ? String(senderName).slice(0, 60) : null,
        replyTo: replyTo && ID_RE.test(String(replyTo)) ? String(replyTo) : null,
      })
      .returning();

    const render = await runPairRender({ pairId: row.id, side: 'sender', photoData: personPhotoData, garment });
    await db.update(pairCards).set({ senderRenderUrl: render.imageUrl }).where(eq(pairCards.id, row.id));

    await logFunnelEvent(db, {
      eventType: 'pair_created',
      source: 'web',
      metadata: {
        pairId: row.id,
        surface: 'pair',
        garmentKind: garment.kind,
        provider: render.provider,
        imageConditioned: render.imageConditioned,
        shareId: sanitizeShareId(shareId),
        shareChannel: shareChannel ? String(shareChannel).slice(0, 24) : undefined,
      },
    });

    res.json({ id: row.id, pageUrl: `${webBase()}/pair/${row.id}`, senderRenderUrl: render.imageUrl, garment });
  } catch (err) {
    logger.error('pair create failed', { route: 'pair' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Public read ────────────────────────────────────────────────────
router.get('/:id', generalLimit, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid pair id' });
    const db = getDb();
    const [row] = await db.select().from(pairCards).where(eq(pairCards.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: 'pair not found' });
    await logFunnelEvent(db, {
      eventType: 'pair_card_viewed',
      source: 'web',
      metadata: { pairId: row.id, surface: 'pair', status: row.status },
    });
    res.json(await publicView(row));
  } catch (err) {
    logger.error('pair lookup failed', { route: 'pair', id: req.params.id }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Join: recipient's half → composite card ────────────────────────
router.post('/:id/join', aiAuth, expensiveRateLimit, expensiveDailyLimit, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid pair id' });
    const { personPhotoData, recipientName, listingId, garmentPhotoData, shareId } = req.body || {};
    if (!isPhotoData(personPhotoData)) {
      return res.status(400).json({ error: 'personPhotoData (data:image/..., under 6 MB) required' });
    }
    const db = getDb();
    const [row] = await db.select().from(pairCards).where(eq(pairCards.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: 'pair not found' });
    if (row.status === 'complete' && row.cardUrl) {
      return res.json({ id: row.id, status: 'complete', cardUrl: row.cardUrl, pageUrl: `${webBase()}/pair/${row.id}` });
    }
    if (!row.senderRenderUrl) {
      return res.status(409).json({ error: 'sender render is not ready yet — try again in a moment' });
    }

    // Optional swap: the recipient can try on a different garment.
    const garment = await resolveGarment(db, { listingId, garmentPhotoData });
    const effectiveGarment = garment || row.garment;
    const swapped = Boolean(garment) && garment.imageUrl !== row.garment?.imageUrl;

    const render = await runPairRender({ pairId: row.id, side: 'recipient', photoData: personPhotoData, garment: effectiveGarment });

    const { r2Key, url } = await composePairCard({
      leftImage: row.senderRenderUrl,
      rightImage: render.imageUrl,
      leftName: row.senderName,
      rightName: recipientName ? String(recipientName).slice(0, 60) : null,
      caption: row.caption,
      garmentTitle: row.garment?.title,
      garmentImageUrl: row.garment?.imageUrl,
      r2Prefix: `pair-cards/${row.id}`,
    });

    const [updated] = await db
      .update(pairCards)
      .set({
        status: 'complete',
        recipientName: recipientName ? String(recipientName).slice(0, 60) : row.recipientName,
        recipientRenderUrl: render.imageUrl,
        recipientGarmentUrl: swapped ? garment.imageUrl : null,
        cardR2Key: r2Key,
        cardUrl: url,
        completedAt: new Date(),
      })
      .where(eq(pairCards.id, row.id))
      .returning();

    await logFunnelEvent(db, {
      eventType: 'pair_completed',
      source: 'web',
      metadata: {
        pairId: row.id,
        surface: 'pair',
        swapped,
        provider: render.provider,
        imageConditioned: render.imageConditioned,
        shareId: sanitizeShareId(shareId),
      },
    });

    res.json({ id: row.id, status: 'complete', cardUrl: url, pageUrl: `${webBase()}/pair/${row.id}`, recipientRenderUrl: render.imageUrl });
  } catch (err) {
    logger.error('pair join failed', { route: 'pair', id: req.params.id }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.__test = { isPhotoData, resolveGarment, ID_RE };
