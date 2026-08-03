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

const PLACEHOLDER = 'https://images.unsplash.com/photo-1485468534356-0c53285c0a8c.jpg?auto=format&fit=crop&w=600&q=60';

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
async function tryOnGarment({ garmentImageUrl, garmentDescription, photoData, photoUrl } = {}) {
  if (!garmentImageUrl) throw new Error('garmentImageUrl is required');
  const humanImg = isValidPhotoData(photoData) ? photoData : isValidPhotoUrl(photoUrl) ? photoUrl : null;
  if (!humanImg) {
    throw new Error('Provide a person photo: photoData (base64 data URI) or photoUrl (https image URL)');
  }
  if (!process.env.REPLICATE_API_TOKEN) {
    logger.info('Prava try-on self-check (no REPLICATE_API_TOKEN) — placeholder render', {
      component: 'prava-tryon',
      garmentImageUrl,
    });
    return { renderUrl: PLACEHOLDER, provider: 'self-check-placeholder' };
  }
  try {
    const renderUrl = await engine.runReplicatePrediction({
      version: engine.IDM_VTON_VERSION,
      input: {
        garm_img: garmentImageUrl,
        human_img: humanImg,
        garment_des: garmentDescription || 'fashion garment',
      },
      timeoutMs: 120000,
    });
    return { renderUrl, provider: 'replicate-idm-vton' };
  } catch (e) {
    logger.error('Prava try-on Replicate call failed', { component: 'prava-tryon' }, e);
    if (e.code === 'REPLICATE_PREDICTION_FAILED') {
      const error = new Error('This product photo and person photo could not produce a reliable fit preview. Try another photo or continue without try-on.');
      error.code = 'TRY_ON_INPUT_UNSUPPORTED';
      error.status = 422;
      error.context = { provider: 'replicate', ...e.context };
      throw error;
    }
    const error = new Error(e.status === 429 ? 'The fit renderer is busy. Please wait before retrying.' : 'The fit renderer is temporarily unavailable. You can retry or continue without try-on.');
    error.code = e.status === 429 ? 'TRY_ON_RATE_LIMITED' : 'TRY_ON_PROVIDER_UNAVAILABLE';
    error.status = e.status === 429 ? 429 : 502;
    error.context = { provider: 'replicate', ...e.context };
    throw error;
  }
}

module.exports = { tryOnGarment, isValidPhotoData, isValidPhotoUrl };
