/**
 * Gemini Image Try-On — image-edit stage for the virtual try-on fallback
 * chain (between Replicate IDM-VTON and Venice text-to-image).
 *
 * Uses @google/genai generateContent with an image-capable model
 * (env GEMINI_TRYON_MODEL, default gemini-2.5-flash-image), passing the
 * person photo plus up to two garment images (top then bottom) as inline
 * parts and returning the first inline image from the response as a
 * data URI.
 */

const logger = require('./logger');

const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const MAX_GARMENT_IMAGES = 2;

let client = null;
let clientKey = null;
let injectedClient = null;

/** Lazily build a Gemini client — gated on env so tests can set it late. */
function getClient() {
  if (injectedClient) return injectedClient;
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_gemini_api_key_here') return null;
  if (client && clientKey === key) return client;
  const { GoogleGenAI } = require('@google/genai');
  client = new GoogleGenAI({ apiKey: key });
  clientKey = key;
  return client;
}

function tryOnModel() {
  return process.env.GEMINI_TRYON_MODEL || DEFAULT_MODEL;
}

/** Convert a data URI or https(s) URL into a Gemini inlineData part. */
async function toInlineImagePart(image, label) {
  if (typeof image !== 'string' || !image) {
    throw geminiError('GEMINI_BAD_INPUT', `${label} is not a usable image reference`);
  }
  const dataUriMatch = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (dataUriMatch) {
    return { inlineData: { mimeType: dataUriMatch[1], data: dataUriMatch[2] } };
  }
  if (/^https?:\/\//.test(image)) {
    const res = await fetch(image);
    if (!res.ok) {
      throw geminiError('GEMINI_FETCH_FAILED', `failed to fetch ${label} image (${res.status})`);
    }
    const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    return { inlineData: { mimeType, data: buf.toString('base64') } };
  }
  throw geminiError('GEMINI_BAD_INPUT', `${label} must be a data URI or http(s) URL`);
}

function geminiError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.name = 'GeminiTryOnError';
  return err;
}

/** Pull the first inline image part out of a generateContent response. */
function extractInlineImage(response) {
  const candidates = response?.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      const inline = part?.inlineData || part?.inline_data;
      if (inline?.data) {
        return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`;
      }
    }
  }
  return null;
}

/**
 * Run a Gemini image-edit try-on.
 *
 * @param {Object} opts
 * @param {string} opts.humanImage — person photo (data URI or https URL)
 * @param {string[]} opts.garmentImages — up to 2 garments (top then bottom)
 * @param {string} [opts.garmentDescription]
 * @returns {Promise<{generatedImage: string, model: string}>}
 */
async function runGeminiTryOn({ humanImage, garmentImages = [], garmentDescription, model, client: overrideClient } = {}) {
  const activeClient = overrideClient || getClient();
  if (!activeClient) {
    throw geminiError('GEMINI_NOT_CONFIGURED', 'GEMINI_API_KEY not configured');
  }
  if (!humanImage || garmentImages.length === 0) {
    throw geminiError('GEMINI_BAD_INPUT', 'person image and at least one garment image are required');
  }

  const personPart = await toInlineImagePart(humanImage, 'person');
  const garmentParts = [];
  for (const [i, garment] of garmentImages.slice(0, MAX_GARMENT_IMAGES).entries()) {
    garmentParts.push(await toInlineImagePart(garment, `garment ${i + 1}`));
  }

  const prompt = [
    'You are a virtual try-on engine. Keep the person\'s face, body, pose,',
    'and background exactly as they appear in the first image. Dress them in',
    `the garment${garmentParts.length > 1 ? 's' : ''} shown in the following image${garmentParts.length > 1 ? 's' : ''}`,
    garmentParts.length > 1 ? ' (top garment first, then bottom).' : '.',
    garmentDescription ? `Garment details: ${garmentDescription}.` : '',
    'Return only the edited photo-realistic image.',
  ].join(' ').replace(/\s+/g, ' ').trim();

  const response = await activeClient.models.generateContent({
    model: model || tryOnModel(),
    contents: [{ role: 'user', parts: [{ text: prompt }, personPart, ...garmentParts] }],
  });

  const generatedImage = extractInlineImage(response);
  if (!generatedImage) {
    logger.warn('Gemini try-on returned no image part', {
      component: 'gemini-tryon',
      model: model || tryOnModel(),
    });
    throw geminiError('GEMINI_NO_IMAGE', 'Gemini response contained no inline image');
  }

  return { generatedImage, model: model || tryOnModel() };
}

module.exports = { runGeminiTryOn };
module.exports.__test = {
  toInlineImagePart,
  extractInlineImage,
  tryOnModel,
  setClient(c) { injectedClient = c; client = null; clientKey = null; },
  reset() { injectedClient = null; client = null; clientKey = null; },
};
