/**
 * Prava Try-On — decoupled IDM-VTON for the agent-checkout flow.
 *
 * OnPoint's paid try-on route (/api/agent/try-on) is coupled to a curator
 * listing + x402 payment. The Prava/Linq flow buys from real UCP fashion
 * merchants (Alo, Everlane…), so the "garment" is a UCP product image, not
 * an OnPoint listing. This helper runs the same Replicate IDM-VTON engine
 * directly on { garmentImageUrl, personPhotoData } — the "try-on-before-
 * agent-buys" leg that is the demo's original insight (ADR 0017).
 *
 * Reuses engine.runReplicatePrediction + engine.IDM_VTON_VERSION from
 * routes/ai-virtual-tryon.js (no duplication of the Replicate integration).
 *
 * Self-check: when REPLICATE_API_TOKEN is unset, returns a deterministic
 * placeholder render so the spine is walkable without the token.
 */

const logger = require('./logger');
const { engine } = require('../routes/ai-virtual-tryon');

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1485468534356-0c53285c0a8c.jpg?auto=format&fit=crop&w=600&q=60';

function isValidPhotoData(photoData) {
  if (typeof photoData !== 'string') return false;
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(photoData) && photoData.length < 8_000_000;
}

function isValidPhotoUrl(url) {
  // Accept https image URLs, allowing trailing query strings (CDN images
  // almost always carry ?w=…&q=…). e.g. .../photo.jpg?auto=format&w=600
  return typeof url === 'string' && /^https?:\/\/.+\.(png|jpe?g|webp)(\?.*)?$/i.test(url);
}

/**
 * Run IDM-VTON on a UCP garment image + a person photo.
 * Accepts the person photo as a base64 data URI (photoData, from a webhook
 * payload) OR an https image URL (photoUrl, e.g. a Linq media URL).
 * @returns { renderUrl, provider } — the try-on render image URL.
 */
async function tryOnGarment({ garmentImageUrl, photoData, photoUrl } = {}) {
  if (!garmentImageUrl) throw new Error('garmentImageUrl is required');
  const humanImg = isValidPhotoData(photoData)
    ? photoData
    : isValidPhotoUrl(photoUrl)
      ? photoUrl
      : null;
  if (!humanImg) {
    throw new Error('Provide a person photo: photoData (base64 data URI) or photoUrl (https image URL)');
  }
  if (!process.env.REPLICATE_API_TOKEN) {
    logger.info('Prava try-on self-check (no REPLICATE_API_TOKEN) — placeholder render', {
      component: 'prava-tryon', garmentImageUrl,
    });
    return { renderUrl: PLACEHOLDER, provider: 'self-check-placeholder' };
  }
  try {
    const renderUrl = await engine.runReplicatePrediction({
      version: engine.IDM_VTON_VERSION,
      input: { garm_img: garmentImageUrl, human_img: humanImg },
      timeoutMs: 120000,
    });
    return { renderUrl, provider: 'replicate-idm-vton' };
  } catch (e) {
    logger.error('Prava try-on Replicate call failed', { component: 'prava-tryon' }, e);
    throw e;
  }
}

module.exports = { tryOnGarment, isValidPhotoData, isValidPhotoUrl };
