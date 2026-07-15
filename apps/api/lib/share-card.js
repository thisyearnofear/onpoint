/**
 * Share Card Generator — composes a try-on render + look items into an
 * Instagram-ready collage image (1080x1350 portrait).
 *
 * Layout:
 *   ┌─────────────────────────┐
 *   │  Hero try-on render     │  (60% height)
 *   │  (face + outfit)        │
 *   │                         │
 *   ├─────────────────────────┤
 *   │  Item thumbnails strip  │  (20% height)
 *   │  [img] [img] [img]      │
 *   ├─────────────────────────┤
 *   │  "Styled by 0xABCD…     │  (10% height)
 *   │   onpoint.fam/look/…"   │
 *   └─────────────────────────┘
 *
 * Output: WebP image uploaded to R2 with a public URL.
 */

const sharp = require('sharp');
const { R2Storage } = require('@repo/storage');

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;
const HERO_HEIGHT = 810;      // 60%
const THUMB_HEIGHT = 270;     // 20%
const FOOTER_HEIGHT = 270;    // 20%

const FOOTER_BG = '#0a0a0a';
const FOOTER_TEXT = '#ffffff';
const ACCENT = '#e94560';

/**
 * Generate a share card from a try-on render and look items.
 *
 * @param {Object} opts
 * @param {string} opts.tryOnImageBase64 - base64 data URI of the try-on render
 * @param {Array} opts.items - [{ imageUrl, title, isHero }]
 * @param {string} opts.agentAddress - the agent's wallet address
 * @param {string} opts.lookSlug - the look's slug
 * @param {string} opts.lookTitle - the look's title
 * @returns {Promise<{ r2Key: string, url: string }>}
 */
async function generateShareCard(opts) {
  const { tryOnImageBase64, items, agentAddress, lookSlug, lookTitle } = opts;

  if (!tryOnImageBase64) throw new Error('tryOnImageBase64 required');

  // ── 1. Prepare hero image (try-on render) ──
  const heroBuffer = Buffer.from(tryOnImageBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  const heroImg = await sharp(heroBuffer)
    .resize(CARD_WIDTH, HERO_HEIGHT, { fit: 'cover', position: 'attention' })
    .toBuffer();

  // ── 2. Prepare item thumbnails ──
  const thumbSize = 200;
  const thumbGap = 20;
  const thumbCount = Math.min(items.length, 4);
  const thumbStripWidth = CARD_WIDTH;

  // Download and resize each thumbnail
  const thumbBuffers = [];
  for (let i = 0; i < thumbCount; i++) {
    const item = items[i];
    if (!item.imageUrl) continue;
    try {
      const resp = await fetch(item.imageUrl);
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      const thumb = await sharp(buf)
        .resize(thumbSize, thumbSize, { fit: 'cover' })
        .toBuffer();
      thumbBuffers.push(thumb);
    } catch {
      // Skip failed thumbnails
    }
  }

  // Compose thumbnail strip
  const thumbY = (THUMB_HEIGHT - thumbSize) / 2;
  const totalThumbWidth = thumbBuffers.length * thumbSize + (thumbBuffers.length - 1) * thumbGap;
  const thumbStartX = (thumbStripWidth - totalThumbWidth) / 2;

  const thumbComposites = thumbBuffers.map((buf, i) => ({
    input: buf,
    left: Math.round(thumbStartX + i * (thumbSize + thumbGap)),
    top: Math.round(thumbY),
  }));

  const thumbStrip = await sharp({
    create: {
      width: thumbStripWidth,
      height: THUMB_HEIGHT,
      channels: 3,
      background: { r: 17, g: 17, b: 17 },
    },
  })
    .composite(thumbComposites)
    .png()
    .toBuffer();

  // ── 3. Build footer with text ──
  const agentShort = `${agentAddress.slice(0, 6)}…${agentAddress.slice(-4)}`;
  const footerText = `Styled by ${agentShort}`;
  const lookText = lookTitle || `onpoint.fam/look/${lookSlug}`;

  // Use SVG for text rendering
  const footerSvg = `<svg width="${CARD_WIDTH}" height="${FOOTER_HEIGHT}">
    <rect width="${CARD_WIDTH}" height="${FOOTER_HEIGHT}" fill="${FOOTER_BG}"/>
    <text x="${CARD_WIDTH / 2}" y="80" font-family="sans-serif" font-size="42" font-weight="bold" fill="${ACCENT}" text-anchor="middle">OnPoint</text>
    <text x="${CARD_WIDTH / 2}" y="140" font-family="sans-serif" font-size="32" font-weight="bold" fill="${FOOTER_TEXT}" text-anchor="middle">${escapeXml(footerText)}</text>
    <text x="${CARD_WIDTH / 2}" y="190" font-family="sans-serif" font-size="28" fill="#999999" text-anchor="middle">${escapeXml(lookText)}</text>
    <text x="${CARD_WIDTH / 2}" y="240" font-family="sans-serif" font-size="22" fill="#666666" text-anchor="middle">onpoint.fam/look/${escapeXml(lookSlug)}</text>
  </svg>`;

  const footerBuffer = Buffer.from(footerSvg);

  // ── 4. Compose the full card ──
  const card = await sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 3,
      background: { r: 10, g: 10, b: 10 },
    },
  })
    .composite([
      { input: heroImg, left: 0, top: 0 },
      { input: thumbStrip, left: 0, top: HERO_HEIGHT },
      { input: footerBuffer, left: 0, top: HERO_HEIGHT + THUMB_HEIGHT },
    ])
    .webp({ quality: 85 })
    .toBuffer();

  // ── 5. Upload to R2 ──
  const r2 = new R2Storage({
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL || '',
  });

  const r2Key = `looks/${lookSlug}/share-card-${Date.now()}.webp`;
  await r2.put(r2Key, card, 'image/webp');

  return {
    r2Key,
    url: r2.publicUrl(r2Key),
  };
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { generateShareCard };
