/**
 * WhatsApp Photo Ingest Pipeline
 *
 * Core agent tool: downloads media from Meta WhatsApp Business API → uploads
 * to Cloudflare R2 → creates or updates a listing in Neon.
 *
 * Used by:
 *   - Future Spectrum-ts agent server (when Curator sends "+ club type size
 *     price qty" + a photo)
 *   - apps/api/routes/agent-whatsapp.js (HTTP test wrapper)
 *
 * Required env vars:
 *   NEON_DATABASE_URL     — Postgres connection string
 *   WA_ACCESS_TOKEN       — Meta WhatsApp Business API token
 *   WA_PHONE_NUMBER_ID    — WhatsApp Business phone number ID (for validation)
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * Flow:
 *   1. GET https://graph.facebook.com/v21.0/{mediaId} → { url, mime_type }
 *   2. GET {url} with Bearer token → Buffer
 *   3. Check if listing already exists for curator+sku (to determine correct ID)
 *   4. Resolve club+kitType → kit_skus.id via Drizzle
 *   5. Upload photo to R2 at curators/{slug}/listings/{id}/1.jpg
 *   6. Upsert the Neon listing (create or merge sizes + append photoKey)
 *   7. Return { listing, r2Key, storefrontUrl }
 *
 * @module whatsapp-ingest
 */

const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, and } = require('drizzle-orm');
const { curators, listings, kitSkus } = require('@repo/db');
const { upload, keyFor } = require('@repo/storage');
const logger = require('./logger');

const META_API_VERSION = 'v21.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ── Lazy Neon Connection ──────────────────────────────────────

let _sql = null;
let _db = null;

function getDb() {
  if (!_sql) {
    const url = process.env.NEON_DATABASE_URL;
    if (!url) throw new Error('NEON_DATABASE_URL not configured');
    _sql = neon(url);
    _db = drizzle(_sql, { schema: { curators, listings, kitSkus } });
  }
  return { sql: _sql, db: _db };
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Normalise a club name to a slug for fuzzy SKU matching.
 * "Arsenal FC" → "arsenal-fc", "Manchester United" → "manchester-united"
 */
function normaliseClub(club) {
  return club
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Coerce a kit type string to one of the valid enum values.
 * "Home" → "home", "AWAY" → "away", "3rd" → "third", etc.
 */
function normaliseKitType(kitType) {
  const map = {
    home: 'home',
    away: 'away',
    third: 'third',
    '3rd': 'third',
    '3': 'third',
    goalkeeper: 'goalkeeper',
    gk: 'goalkeeper',
  };
  return map[kitType.toLowerCase().trim()] || kitType.toLowerCase();
}

// ── Pipeline Steps ─────────────────────────────────────────────

/**
 * Step 1: Download media from Meta WhatsApp Business API.
 *
 * GETs the media metadata (which includes the download URL), then
 * fetches the binary data from that URL. Both requests use the same
 * WA_ACCESS_TOKEN Bearer token.
 *
 * @param {string} mediaId  — Meta media object ID (from webhook)
 * @param {string} accessToken — WA_ACCESS_TOKEN
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
async function downloadFromMeta(mediaId, accessToken) {
  const metaUrl = `${META_BASE}/${mediaId}`;
  logger.info('Fetching media metadata from Meta', {
    component: 'whatsapp-ingest',
    mediaId,
  });

  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!metaRes.ok) {
    const body = await metaRes.text().catch(() => '');
    throw new Error(
      `Meta media metadata error (${metaRes.status}): ${body.substring(0, 200)}`,
    );
  }

  const { url, mime_type } = await metaRes.json();
  if (!url) {
    throw new Error(`Meta returned no download URL for media ${mediaId}`);
  }

  logger.info('Downloading media from Meta URL', {
    component: 'whatsapp-ingest',
    mediaId,
    mimeType: mime_type,
  });

  const dlRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30000),
  });

  if (!dlRes.ok) {
    throw new Error(`Meta media download error (${dlRes.status})`);
  }

  const buffer = Buffer.from(await dlRes.arrayBuffer());
  const contentType = mime_type || 'image/jpeg';

  // Reject non-image content types (videos, documents, audio)
  if (!contentType.startsWith('image/')) {
    throw new Error(
      `Unsupported media type: "${contentType}". Only images are supported for product listings.`,
    );
  }

  // Reject images larger than 10MB (Meta allows up to 16MB for images)
  const MAX_BYTES = 10 * 1024 * 1024;
  if (buffer.length > MAX_BYTES) {
    throw new Error(
      `Image too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Maximum is 10MB.`,
    );
  }

  logger.info('Media downloaded', {
    component: 'whatsapp-ingest',
    mediaId,
    bytes: buffer.length,
    contentType,
  });

  return { buffer, contentType };
}

/**
 * Step 2: Resolve a club + kitType string to a kit_skus row.
 *
 * Performs a fuzzy match on club name (normalised to slug prefix)
 * and an exact match on kitType.
 *
 * @param {string} club     — e.g. "Arsenal"
 * @param {string} kitType  — e.g. "home"
 * @param {object} db       — Drizzle ORM instance
 * @param {function} sql    — Neon SQL template tag (for LIKE queries)
 * @returns {Promise<object>} — the matched kit_skus row
 * @throws {Error} if nothing matches
 */
async function resolveSku(club, kitType, db, sql) {
  const clubSlug = normaliseClub(club);

  // Try exact match first: id = "{clubSlug}-2425-{kitType}"
  const exactId = `${clubSlug}-2425-${kitType}`;
  const [exact] = await db
    .select()
    .from(kitSkus)
    .where(eq(kitSkus.id, exactId))
    .limit(1);

  if (exact) return exact;

  // Fallback: LIKE match on id prefix + exact kitType
  const [fuzzy] = await db
    .select()
    .from(kitSkus)
    .where(
      and(
        sql`${kitSkus.id} LIKE ${`${clubSlug}-%`}`,
        eq(kitSkus.kitType, kitType),
      ),
    )
    .limit(1);

  if (fuzzy) return fuzzy;

  // Last resort: LIKE match on club name (not id)
  // Catches cases where the stored slug differs from what the Curator typed
  const [byClub] = await db
    .select()
    .from(kitSkus)
    .where(
      and(
        sql`LOWER(${kitSkus.club}) LIKE ${`%${clubSlug.replace(/-/g, '%')}%`}`,
        eq(kitSkus.kitType, kitType),
      ),
    )
    .limit(1);

  if (byClub) return byClub;

  throw new Error(
    `No kit SKU found for club="${club}" (slug="${clubSlug}") kitType="${kitType}". ` +
      `Check the club name and kit type and try again. Use "stock" to see available inventory.`,
  );
}

/**
 * Step 3: Resolve a listing ID — find existing or generate new.
 *
 * Performed early (before R2 upload) so the photo key is correct
 * on the first upload and no orphan is created.
 *
 * @param {object} params
 * @param {string} params.curatorSlug
 * @param {string} params.skuId
 * @param {object} params.db — Drizzle instance
 * @returns {Promise<{listingId: string, existing: object|null}>}
 */
async function resolveListingId({ curatorSlug, skuId, db }) {
  const [existing] = await db
    .select()
    .from(listings)
    .where(
      and(
        eq(listings.curatorSlug, curatorSlug),
        eq(listings.skuId, skuId),
      ),
    )
    .limit(1);

  if (existing) {
    return { listingId: existing.id, existing };
  }

  return { listingId: crypto.randomUUID(), existing: null };
}

/**
 * Step 4: Upload a photo to R2 and return the key.
 *
 * Uses @repo/storage's upload() and keyFor helpers for a consistent
 * R2 key pattern: curators/{slug}/listings/{id}/{n}.jpg
 *
 * @param {Buffer} buffer       — raw image bytes
 * @param {string} contentType  — MIME type
 * @param {string} listingId    — UUID of the listing
 * @param {string} curatorSlug  — e.g. "wanja"
 * @returns {Promise<string>}   — the R2 key
 */
async function uploadToR2(buffer, contentType, listingId, curatorSlug) {
  const key = keyFor.listingPhoto(curatorSlug, listingId, 1);

  await upload(key, buffer, contentType);

  logger.info('Photo uploaded to R2', {
    component: 'whatsapp-ingest',
    key,
    bytes: buffer.length,
  });

  return key;
}

/**
 * Step 5: Create or update a listing in Neon.
 *
 * If a listing already exists for this curator + sku, merge the new
 * size into the existing sizes array (update stock/price if size
 * exists, append if new). Otherwise create a new listing.
 *
 * @param {object} params
 * @param {string}  params.curatorSlug
 * @param {string}  params.skuId
 * @param {string}  params.listingId   — resolved listing ID (existing or new)
 * @param {string}  params.size        — e.g. "M"
 * @param {number}  params.price       — e.g. 2500
 * @param {number}  params.qty         — e.g. 4
 * @param {string|null}  params.existing — existing row (null if new)
 * @param {string}  params.r2Key       — R2 key of the uploaded photo
 * @param {object}  params.db          — Drizzle instance
 * @returns {Promise<{listing: object, isNew: boolean}>}
 */
async function upsertListing({ curatorSlug, skuId, listingId, existing, size, price, qty, r2Key, db }) {
  if (existing) {
    // ── Update existing listing ───────────────────────────────
    const currentSizes = Array.isArray(existing.sizes) ? existing.sizes : [];
    const sizeIndex = currentSizes.findIndex((s) => s.size === size);
    let newSizes;

    if (sizeIndex >= 0) {
      // Size already exists — update stock AND price
      newSizes = [...currentSizes];
      newSizes[sizeIndex] = { size, stock: qty, price };
    } else {
      // New size — append
      newSizes = [...currentSizes, { size, stock: qty, price }];
    }

    // Append photo key (deduped — multiple photos for same listing is fine)
    const photoKeys = [...(existing.photoKeys || [])];
    if (r2Key && !photoKeys.includes(r2Key)) {
      photoKeys.push(r2Key);
    }

    await db
      .update(listings)
      .set({
        sizes: newSizes,
        photoKeys,
        status: 'live',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(listings.id, existing.id));

    const [updated] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, existing.id))
      .limit(1);

    logger.info('Listing updated', {
      component: 'whatsapp-ingest',
      listingId: existing.id,
      curatorSlug,
      skuId,
      size,
      stock: qty,
      price,
    });

    return { listing: updated, isNew: false };
  }

  // ── Create new listing ─────────────────────────────────────
  const now = new Date().toISOString();

  await db.insert(listings).values({
    id: listingId,
    curatorSlug,
    skuId,
    sizes: [{ size, stock: qty, price }],
    photoKeys: r2Key ? [r2Key] : [],
    status: 'live',
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  logger.info('Listing created', {
    component: 'whatsapp-ingest',
    listingId,
    curatorSlug,
    skuId,
    size,
    stock: qty,
    price,
  });

  return { listing: created, isNew: true };
}

// ── Orchestrator ────────────────────────────────────────────────

/**
 * Ingest a WhatsApp media attachment into the OnPoint product catalog.
 *
 * This is the primary entry point. It orchestrates all pipeline steps:
 * Meta download → SKU resolution → R2 upload → Neon upsert.
 *
 * Designed to be called from the Spectrum-ts agent server or an
 * Express route wrapper.
 *
 * @param {object} params
 * @param {string} params.mediaId        — Meta media object ID (from webhook)
 * @param {string} [params.curatorSlug]  — Curator slug (resolved from sender)
 * @param {string} params.club           — From parsed command: e.g. "Arsenal"
 * @param {string} params.kitType        — From parsed command: e.g. "home"
 * @param {string} params.size           — From parsed command: e.g. "M"
 * @param {number} params.price          — From parsed command: e.g. 2500
 * @param {number} params.qty            — From parsed command: e.g. 4
 * @param {string} [params.accessToken]  — Override WA_ACCESS_TOKEN (for testing)
 *
 * @returns {Promise<{success: boolean, listing?: object, r2Key?: string,
 *                    storefrontUrl?: string, error?: string}>}
 */
async function ingestMedia({
  mediaId,
  curatorSlug,
  club,
  kitType,
  size,
  price,
  qty,
  accessToken,
}) {
  const token = accessToken || process.env.WA_ACCESS_TOKEN;

  // ── Validate inputs ───────────────────────────────────────
  const errors = [];
  if (!mediaId) errors.push('mediaId is required');
  if (!curatorSlug) errors.push('curatorSlug is required');
  if (!club) errors.push('club is required');
  if (!kitType) errors.push('kitType is required');
  if (!size) errors.push('size is required');
  if (price == null || isNaN(Number(price)) || Number(price) <= 0) {
    errors.push('price must be a positive number');
  }
  if (qty == null || isNaN(Number(qty)) || Number(qty) < 0) {
    errors.push('qty must be a non-negative number');
  }
  if (!token) errors.push('WA_ACCESS_TOKEN not configured');

  if (errors.length > 0) {
    return { success: false, error: errors.join('; ') };
  }

  const safePrice = Number(price);
  const safeQty = Number(qty);

  // ── Ensure DB is configured ────────────────────────────────
  let db, sql;
  try {
    ({ db, sql } = getDb());
  } catch (err) {
    logger.error('Database not configured', { component: 'whatsapp-ingest' }, err);
    return { success: false, error: 'Database not configured' };
  }

  // ── Ensure curator exists ──────────────────────────────────
  try {
    const [curator] = await db
      .select()
      .from(curators)
      .where(eq(curators.slug, curatorSlug))
      .limit(1);

    if (!curator) {
      return {
        success: false,
        error: `Curator "${curatorSlug}" not found. Use /api/curator/apply to create one first.`,
      };
    }
  } catch (err) {
    logger.error('Failed to verify curator', { component: 'whatsapp-ingest' }, err);
    return { success: false, error: 'Failed to verify curator' };
  }

  // ── Step 1: Download from Meta ────────────────────────────
  let buffer, contentType;
  try {
    ({ buffer, contentType } = await downloadFromMeta(mediaId, token));
  } catch (err) {
    logger.error('Media download failed', { component: 'whatsapp-ingest', mediaId }, err);
    return {
      success: false,
      error: `Failed to download media from Meta: ${err.message}`,
    };
  }

  // ── Step 2: Resolve SKU ───────────────────────────────────
  let sku;
  try {
    sku = await resolveSku(club, kitType, db, sql);
  } catch (err) {
    logger.error('SKU resolution failed', {
      component: 'whatsapp-ingest',
      club,
      kitType,
    }, err);
    return { success: false, error: err.message };
  }

  // ── Step 3: Resolve listing ID (before R2 upload) ─────────
  // This avoids orphan R2 uploads on the update path — we know
  // the correct listing ID before building the photo key.
  let listingId, existing;
  try {
    ({ listingId, existing } = await resolveListingId({
      curatorSlug,
      skuId: sku.id,
      db,
    }));
  } catch (err) {
    logger.error('Listing ID resolution failed', {
      component: 'whatsapp-ingest',
      curatorSlug,
      skuId: sku.id,
    }, err);
    return { success: false, error: `Failed to resolve listing: ${err.message}` };
  }

  // ── Step 4: Upload to R2 ──────────────────────────────────
  let r2Key;
  try {
    r2Key = await uploadToR2(buffer, contentType, listingId, curatorSlug);
  } catch (err) {
    logger.error('R2 upload failed', {
      component: 'whatsapp-ingest',
      curatorSlug,
    }, err);
    return { success: false, error: `Failed to upload photo: ${err.message}` };
  }

  // ── Step 5: Upsert listing ────────────────────────────────
  let listing, isNew;
  try {
    ({ listing, isNew } = await upsertListing({
      curatorSlug,
      skuId: sku.id,
      listingId,
      existing,
      size,
      price: safePrice,
      qty: safeQty,
      r2Key,
      db,
    }));
  } catch (err) {
    logger.error('Listing upsert failed', {
      component: 'whatsapp-ingest',
      curatorSlug,
      skuId: sku.id,
    }, err);
    return { success: false, error: `Failed to save listing: ${err.message}` };
  }

  const baseUrl = process.env.STORE_URL || 'https://onpoint.famile.xyz';

  return {
    success: true,
    listing: {
      id: listing.id,
      curatorSlug: listing.curatorSlug,
      skuId: listing.skuId,
      sizes: listing.sizes,
      photoKeys: listing.photoKeys,
      status: listing.status,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      kit: {
        club: sku.club,
        kitType: sku.kitType,
        season: sku.season,
      },
    },
    r2Key,
    sizeUpdated: size,
    qty: safeQty,
    price: safePrice,
    isNew,
    storefrontUrl: `${baseUrl}/s/${curatorSlug}`,
  };
}

module.exports = {
  ingestMedia,
  // Exposed for unit testing / direct use
  downloadFromMeta,
  resolveSku,
  resolveListingId,
  uploadToR2,
  upsertListing,
  normaliseClub,
  normaliseKitType,
};
