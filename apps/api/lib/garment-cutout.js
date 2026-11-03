/**
 * Garment Cutout — optional AI product-shot extraction for listings.
 *
 * OFF BY DEFAULT: enabled only when GARMENT_CUTOUT_ENABLED=1 and an
 * OpenAI image key is configured. When on, ensureCutout generates a
 * clean white-background product shot via the OpenAI images/edits
 * endpoint, uploads it to R2, and merges { cutoutKey } into the
 * listing's attributes jsonb (preserving existing attributes).
 *
 * Config:
 *   GARMENT_CUTOUT_ENABLED   '1' to enable
 *   OPENAI_IMAGE_API_KEY     preferred key (falls back to OPENAI_API_KEY)
 *   OPENAI_IMAGE_BASE_URL    default https://api.openai.com/v1
 *   OPENAI_IMAGE_MODEL       default gpt-image-1
 */

const logger = require('./logger');
const storage = require('@repo/storage');
const { eq } = require('drizzle-orm');
const { listings } = require('@repo/db');
const { listingImageUrl } = require('./r2');

const PROMPT =
  'Extract the single main garment from this photo as a clean e-commerce product shot: ' +
  'front view, centered, flat/ghost-mannequin style, no person, no hands, no hanger, ' +
  'plain pure white background, preserve exact colors, logos and print. ' +
  'Do not add or change design details.';

function imageApiKey() {
  return process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY || null;
}

function cutoutEnabled() {
  return process.env.GARMENT_CUTOUT_ENABLED === '1' && Boolean(imageApiKey());
}

function cutoutError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.name = 'GarmentCutoutError';
  return err;
}

function cutoutKeyFor(listing) {
  return `curators/${listing.curatorSlug}/listings/${listing.id}/cutout.png`;
}

/**
 * Generate a garment cutout PNG from a source image URL.
 * @returns {Promise<Buffer>} PNG bytes
 */
async function generateGarmentCutout({ imageUrl, title, fetchImpl = fetch } = {}) {
  if (!imageApiKey()) throw cutoutError('CUTOUT_NOT_CONFIGURED', 'no image API key configured');
  if (typeof imageUrl !== 'string' || !/^https?:\/\//.test(imageUrl)) {
    throw cutoutError('CUTOUT_BAD_INPUT', 'imageUrl must be an http(s) URL');
  }

  const imgRes = await fetchImpl(imageUrl);
  if (!imgRes.ok) {
    throw cutoutError('CUTOUT_FETCH_FAILED', `source image fetch failed (${imgRes.status})`);
  }
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';

  const form = new FormData();
  form.append('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1');
  form.append('image', new Blob([imgBuf], { type: mime }), `garment.${ext}`);
  form.append('size', '1024x1024');
  form.append('prompt', PROMPT + (title ? `\nGarment title: ${title}.` : ''));

  const base = (process.env.OPENAI_IMAGE_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetchImpl(`${base}/images/edits`, {
    method: 'POST',
    headers: { authorization: `Bearer ${imageApiKey()}` },
    body: form,
  });
  if (!res.ok) {
    throw cutoutError('CUTOUT_API_FAILED', `image edit failed (${res.status})`);
  }
  const data = await res.json();
  const first = data?.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, 'base64');
  if (first?.url) {
    const cutRes = await fetchImpl(first.url);
    if (!cutRes.ok) {
      throw cutoutError('CUTOUT_DOWNLOAD_FAILED', `cutout download failed (${cutRes.status})`);
    }
    return Buffer.from(await cutRes.arrayBuffer());
  }
  throw cutoutError('CUTOUT_EMPTY', 'image edit returned no image');
}

/**
 * Ensure a listing has a cutoutKey in its attributes.
 * Generates + uploads + merges when enabled and missing.
 * Never throws — returns the key or null.
 *
 * @param {Object} opts.listing — listings row (needs id, curatorSlug, attributes, photoKeys)
 * @param {Object} opts.db — drizzle instance
 * @param {Function} [opts.uploadFn] — storage upload override (tests)
 * @returns {Promise<string|null>}
 */
async function ensureCutout({ listing, db, uploadFn } = {}) {
  try {
    if (!cutoutEnabled() || !listing?.id) return null;
    if (listing.attributes?.cutoutKey) return listing.attributes.cutoutKey;

    const imageUrl = listingImageUrl(listing);
    if (!imageUrl) return null;

    const png = await generateGarmentCutout({ imageUrl, title: listing.title });
    const key = cutoutKeyFor(listing);
    await (uploadFn || storage.upload)(key, png, 'image/png');

    const attributes = { ...(listing.attributes || {}), cutoutKey: key };
    await db.update(listings).set({ attributes }).where(eq(listings.id, listing.id));

    logger.info('Garment cutout generated', {
      component: 'garment-cutout',
      listingId: listing.id,
      key,
    });
    return key;
  } catch (err) {
    logger.warn('Garment cutout skipped', {
      component: 'garment-cutout',
      listingId: listing?.id,
      error: err?.message,
    });
    return null;
  }
}

module.exports = { cutoutEnabled, generateGarmentCutout, ensureCutout };
module.exports.__test = { PROMPT, cutoutKeyFor };
