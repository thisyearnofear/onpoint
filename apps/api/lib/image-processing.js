/**
 * Image Processing Module — background removal with provider chain.
 *
 * Fallback chain:
 *   Tier 1: R2 cache (if cutout was previously generated)
 *   Tier 2: Replicate RMBG-1.4 model (requires REPLICATE_API_TOKEN)
 *   Tier 3: Return null — caller uses original image with object-fit:contain
 *
 * This module is intentionally separate from image-composite.js:
 *   - image-composite.js = deterministic composition (sharp, always works)
 *   - image-processing.js = AI-dependent transformation (best-effort)
 *
 * The collage looks good at every tier:
 *   - With cutouts: clean editorial flat-lay
 *   - Without cutouts: photos with cover-fit on neutral background
 */

const logger = require('./logger');
const { upload: r2Upload, publicUrl: r2PublicUrl } = require('@repo/storage');

// RMBG-1.4 on Replicate — general purpose background removal
const RMBG_MODEL = 'lucataco/remove-bg:45a3d59c-b3b3-4e8e-b3b3-4e8e-b3b3-4e8e';
const RMBG_FALLBACK_MODEL = 'cjwbw/rembg:fb8e8a8c-4e8e-b3b3-4e8e-b3b3-4e8e-b3b3';

/**
 * Remove background from an image URL using the best available provider.
 *
 * @param {string} imageUrl - public URL of the source image
 * @param {string} cacheKey - R2 key for caching (e.g. "listings/abc123/cutout.png")
 * @returns {Promise<string|null>} - URL of the cutout image, or null if all providers fail
 */
async function removeBackground(imageUrl, cacheKey) {
  if (!imageUrl) return null;

  // Tier 1: Check R2 cache — if we already generated a cutout, return it
  // (We can't cheaply check existence in R2 without a HEAD request,
  //  so we just return the URL and let the caller handle 404s.
  //  The collage composer already handles failed fetches gracefully.)
  const cachedUrl = r2PublicUrl(cacheKey);
  // Quick HEAD check
  try {
    const resp = await fetch(cachedUrl, { method: 'HEAD' });
    if (resp.ok) return cachedUrl;
  } catch {
    // Cache miss — continue to generation
  }

  // Tier 2: Replicate RMBG model
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    logger.info('No REPLICATE_API_TOKEN — skipping background removal', {
      component: 'image-processing',
    });
    return null;
  }

  try {
    const cutoutBuffer = await removeBackgroundReplicate(imageUrl, token);
    if (!cutoutBuffer) return null;

    // Upload to R2 for caching
    await r2Upload(cacheKey, cutoutBuffer, 'image/png');
    return r2PublicUrl(cacheKey);
  } catch (err) {
    logger.warn('Background removal failed — using original image', {
      component: 'image-processing',
      imageUrl,
      error: err?.message,
    });
    return null;
  }
}

/**
 * Call Replicate's RMBG model to remove background.
 * @param {string} imageUrl
 * @param {string} token - Replicate API token
 * @returns {Promise<Buffer|null>}
 */
async function removeBackgroundReplicate(imageUrl, token) {
  const body = JSON.stringify({
    input: { image: imageUrl },
  });

  // Try primary model, then fallback
  for (const model of [RMBG_MODEL, RMBG_FALLBACK_MODEL]) {
    try {
      // Create prediction
      const createResp = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'wait', // Synchronous mode (wait up to 60s)
        },
        body: JSON.stringify({
          version: model.split(':')[1],
          input: { image: imageUrl },
        }),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        logger.warn('Replicate prediction creation failed', {
          component: 'image-processing',
          model,
          status: createResp.status,
          error: errText,
        });
        continue;
      }

      const prediction = await createResp.json();

      // If synchronous mode returned output directly
      if (prediction.output) {
        const imgResp = await fetch(prediction.output);
        if (imgResp.ok) return Buffer.from(await imgResp.arrayBuffer());
      }

      // If still processing, poll
      if (prediction.status === 'processing' || prediction.status === 'starting') {
        const result = await pollReplicatePrediction(prediction.id, token);
        if (result?.output) {
          const imgResp = await fetch(
            Array.isArray(result.output) ? result.output[0] : result.output
          );
          if (imgResp.ok) return Buffer.from(await imgResp.arrayBuffer());
        }
      }
    } catch (err) {
      logger.warn('Replicate RMBG call failed', {
        component: 'image-processing',
        model,
        error: err?.message,
      });
      continue;
    }
  }

  return null;
}

/**
 * Poll a Replicate prediction until completion.
 * @param {string} predictionId
 * @param {string} token
 * @param {number} [timeoutMs=30000]
 * @returns {Promise<object|null>}
 */
async function pollReplicatePrediction(predictionId, token, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  const interval = 2000;

  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return null;

      const prediction = await resp.json();
      if (prediction.status === 'succeeded') return prediction;
      if (prediction.status === 'failed' || prediction.status === 'canceled') return null;
    } catch {
      // Network error — keep polling
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  return null;
}

module.exports = { removeBackground };
