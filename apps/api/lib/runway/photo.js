/**
 * Runway photo fetch (ADR 0022 §5). Downloads the inbound photo, downscales
 * in memory, returns a data URL. The photo is NEVER written to disk, R2,
 * Redis, or logs.
 */

const sharp = require('sharp');

const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

async function fetchAsDataUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`photo fetch failed: HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!/^image\//i.test(type)) throw new Error(`photo fetch failed: content-type ${type || 'unknown'}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('photo too large');
    const out = await sharp(await toJpeg(buf, type))
      .rotate()
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } finally {
    clearTimeout(timer);
  }
}

const MAX_DECODED_BYTES = 8 * 1024 * 1024;

// Prebuilt sharp has no HEVC decoder; heic-convert handles it in pure JS.
async function toJpeg(buf, mime) {
  if (/^image\/(heic|heif)$/i.test(mime)) {
    const convert = require('heic-convert');
    return Buffer.from(await convert({ buffer: buf, format: 'JPEG', quality: 0.9 }));
  }
  return buf;
}

/** Normalise a client-supplied data URL through the same pipeline as a fetch. */
async function normaliseDataUrl(dataUrl) {
  const m = /^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!m) throw new Error('unsupported image data URL');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_DECODED_BYTES) throw new Error('photo too large');
  const jpeg = await toJpeg(buf, `image/${m[1]}`);
  const out = await sharp(jpeg)
    .rotate()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString('base64')}`;
}

module.exports = { fetchAsDataUrl, normaliseDataUrl };
