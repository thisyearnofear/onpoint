/**
 * Image Composition Module — shared sharp-based image compositing.
 *
 * Two modes:
 *   1. composeTryOnShareCard(opts) — try-on render + item thumbnails + branding
 *      (1080x1350 portrait, Instagram-ready)
 *   2. composeLookCollage(opts) — item cutouts arranged on neutral background
 *      with look title + attribution (1080x1350 portrait, editorial)
 *
 * Both use sharp (deterministic, no AI dependency) and upload to R2.
 * AI-enhanced versions (modeled previews, styled flat-lays) can be layered
 * on top by callers — this module is the always-works fallback.
 */

const sharp = require('sharp');
const { upload: r2Upload, publicUrl: r2PublicUrl } = require('@repo/storage');

// ── Shared constants ──

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

const COLORS = {
  bg: { r: 245, g: 245, b: 245 },      // off-white
  dark: { r: 10, g: 10, b: 10 },        // near-black
  accent: '#e94560',
  text: '#1a1a1a',
  textMuted: '#888888',
  textLight: '#ffffff',
};

// ── Helpers ──

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchImageBuffer(url) {
  if (!url) return null;
  if (url.startsWith('data:')) {
    return Buffer.from(url.replace(/^data:[^;]+;base64,/, ''), 'base64');
  }
  if (url.startsWith('http')) {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  }
  // Raw base64
  try {
    return Buffer.from(url, 'base64');
  } catch {
    return null;
  }
}

function shortAddress(addr) {
  if (!addr) return 'Unknown';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Render an SVG text block into a buffer.
 */
function textSvg(width, height, lines, opts = {}) {
  const bg = opts.bg || 'transparent';
  const anchor = opts.anchor || 'middle';
  const x = opts.x ?? width / 2;
  const parts = lines.map(
    (line) =>
      `<text x="${x}" y="${line.y}" font-family="${line.fontFamily || 'sans-serif'}" font-size="${line.size}" font-weight="${line.weight || 'normal'}" fill="${line.fill || COLORS.text}" text-anchor="${anchor}">${escapeXml(line.text)}</text>`
  );
  return Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${bg}"/>${parts.join('')}</svg>`
  );
}

// ── 1. Try-On Share Card (existing behavior, extracted) ──

/**
 * Generate a try-on share card: hero render + thumbnail strip + branding.
 *
 * @param {Object} opts
 * @param {string} opts.tryOnImageBase64 - base64 data URI or URL of the try-on render
 * @param {Array} opts.items - [{ imageUrl, title, isHero }]
 * @param {string} opts.agentAddress - agent's wallet address
 * @param {string} opts.lookSlug - look slug
 * @param {string} opts.lookTitle - look title
 * @returns {Promise<{ r2Key: string, url: string }>}
 */
async function composeTryOnShareCard(opts) {
  const { tryOnImageBase64, items, agentAddress, lookSlug, lookTitle } = opts;

  if (!tryOnImageBase64) throw new Error('tryOnImageBase64 required');

  const HERO_HEIGHT = 810;
  const THUMB_HEIGHT = 270;
  const FOOTER_HEIGHT = 270;

  // 1. Hero image
  const heroBuffer = await fetchImageBuffer(tryOnImageBase64);
  if (!heroBuffer) throw new Error('Failed to load hero image');

  const heroImg = await sharp(heroBuffer)
    .resize(CARD_WIDTH, HERO_HEIGHT, { fit: 'cover', position: 'attention' })
    .toBuffer();

  // 2. Item thumbnails
  const thumbSize = 200;
  const thumbGap = 20;
  const thumbCount = Math.min(items.length, 4);

  const thumbBuffers = [];
  for (let i = 0; i < thumbCount; i++) {
    const buf = await fetchImageBuffer(items[i].imageUrl);
    if (!buf) continue;
    try {
      const thumb = await sharp(buf)
        .resize(thumbSize, thumbSize, { fit: 'cover' })
        .toBuffer();
      thumbBuffers.push(thumb);
    } catch {
      // Skip failed thumbnails
    }
  }

  const thumbY = (THUMB_HEIGHT - thumbSize) / 2;
  const totalThumbWidth =
    thumbBuffers.length * thumbSize + Math.max(0, thumbBuffers.length - 1) * thumbGap;
  const thumbStartX = (CARD_WIDTH - totalThumbWidth) / 2;

  const thumbComposites = thumbBuffers.map((buf, i) => ({
    input: buf,
    left: Math.round(thumbStartX + i * (thumbSize + thumbGap)),
    top: Math.round(thumbY),
  }));

  const thumbStrip = await sharp({
    create: {
      width: CARD_WIDTH,
      height: THUMB_HEIGHT,
      channels: 3,
      background: { r: 17, g: 17, b: 17 },
    },
  })
    .composite(thumbComposites)
    .png()
    .toBuffer();

  // 3. Footer
  const footerBuffer = textSvg(CARD_WIDTH, FOOTER_HEIGHT, [
    { text: 'OnPoint', y: 80, size: 42, weight: 'bold', fill: COLORS.accent },
    { text: `Styled by ${shortAddress(agentAddress)}`, y: 140, size: 32, weight: 'bold', fill: COLORS.textLight },
    { text: lookTitle || `onpoint.fam/look/${lookSlug}`, y: 190, size: 28, fill: '#999999' },
    { text: `onpoint.fam/look/${lookSlug}`, y: 240, size: 22, fill: '#666666' },
  ], { bg: '#0a0a0a' });

  // 4. Compose
  const card = await sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 3,
      background: COLORS.dark,
    },
  })
    .composite([
      { input: heroImg, left: 0, top: 0 },
      { input: thumbStrip, left: 0, top: HERO_HEIGHT },
      { input: footerBuffer, left: 0, top: HERO_HEIGHT + THUMB_HEIGHT },
    ])
    .webp({ quality: 85 })
    .toBuffer();

  // 5. Upload
  const r2Key = `looks/${lookSlug}/share-card-${Date.now()}.webp`;
  await r2Upload(r2Key, card, 'image/webp');

  return { r2Key, url: r2PublicUrl(r2Key) };
}

// ── 2. Look Collage (new — editorial flat-lay) ──

/**
 * Generate a look collage: item images arranged in a grid on a neutral
 * background with look title + agent attribution.
 *
 * This is the Tier 1 (deterministic, always-works) version. It uses
 * sharp to compose item images into a grid — no AI needed. If item
 * images have backgrounds removed (cutoutUrl), the result looks like
 * a clean editorial flat-lay. If not, images are shown with cover fit
 * on the neutral background — still clean and consistent.
 *
 * @param {Object} opts
 * @param {Array} opts.items - [{ imageUrl, title, isHero, cutoutUrl? }]
 * @param {string} opts.lookTitle - look title
 * @param {string} opts.agentAddress - agent's wallet address
 * @param {string} opts.lookSlug - look slug
 * @param {string} [opts.curatorSlug] - optional curator slug for attribution
 * @returns {Promise<{ r2Key: string, url: string }>}
 */
async function composeLookCollage(opts) {
  const { items, lookTitle, agentAddress, lookSlug, curatorSlug } = opts;

  if (!items || items.length === 0) throw new Error('At least one item required');

  const HEADER_HEIGHT = 180;
  const FOOTER_HEIGHT = 180;
  const GRID_HEIGHT = CARD_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;
  const PADDING = 40;
  const GAP = 20;

  // 1. Determine grid layout
  const itemCount = Math.min(items.length, 6);
  let cols, rows;
  if (itemCount <= 1) { cols = 1; rows = 1; }
  else if (itemCount <= 2) { cols = 2; rows = 1; }
  else if (itemCount <= 4) { cols = 2; rows = 2; }
  else { cols = 3; rows = 2; }

  const cellWidth = Math.floor((CARD_WIDTH - PADDING * 2 - GAP * (cols - 1)) / cols);
  const cellHeight = Math.floor((GRID_HEIGHT - PADDING * 2 - GAP * (rows - 1)) / rows);

  // 2. Load and resize item images
  const cellBuffers = [];
  for (let i = 0; i < itemCount; i++) {
    const item = items[i];
    const url = item.cutoutUrl || item.imageUrl;
    const buf = await fetchImageBuffer(url);
    if (!buf) continue;

    try {
      // Use contain fit for cutouts (preserves full item), cover for photos
      const fit = item.cutoutUrl ? 'contain' : 'cover';
      const bg = item.cutoutUrl
        ? { r: 245, g: 245, b: 245, alpha: 0 }
        : { r: 240, g: 240, b: 240 };

      const cell = await sharp(buf)
        .resize(cellWidth, cellHeight, { fit, background: bg })
        .toBuffer();
      cellBuffers.push({ buffer: cell, index: i });
    } catch {
      // Skip failed images — leave cell empty
    }
  }

  // 3. Build grid composites
  const gridComposites = cellBuffers.map(({ buffer, index }) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      input: buffer,
      left: PADDING + col * (cellWidth + GAP),
      top: HEADER_HEIGHT + PADDING + row * (cellHeight + GAP),
    };
  });

  // 4. Hero badge — mark the hero item
  const heroItem = items.find((i) => i.isHero);
  const heroBadges = [];
  if (heroItem) {
    const heroIndex = items.slice(0, itemCount).indexOf(heroItem);
    if (heroIndex >= 0) {
      const row = Math.floor(heroIndex / cols);
      const col = heroIndex % cols;
      const badgeX = PADDING + col * (cellWidth + GAP);
      const badgeY = HEADER_HEIGHT + PADDING + row * (cellHeight + GAP);
      const badgeSvg = Buffer.from(
        `<svg width="80" height="32"><rect width="80" height="32" rx="6" fill="${COLORS.accent}"/><text x="40" y="22" font-family="sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">HERO</text></svg>`
      );
      heroBadges.push({ input: badgeSvg, left: badgeX + 8, top: badgeY + 8 });
    }
  }

  // 5. Header with look title
  const headerBuffer = textSvg(CARD_WIDTH, HEADER_HEIGHT, [
    { text: lookTitle || 'Styled Look', y: 80, size: 48, weight: 'bold', fill: COLORS.text },
    { text: `${itemCount} piece${itemCount > 1 ? 's' : ''}`, y: 130, size: 28, fill: COLORS.textMuted },
  ], { bg: 'transparent' });

  // 6. Footer with attribution
  const attribution = curatorSlug
    ? `by @${curatorSlug} · ${shortAddress(agentAddress)}`
    : `Styled by ${shortAddress(agentAddress)}`;
  const footerBuffer = textSvg(CARD_WIDTH, FOOTER_HEIGHT, [
    { text: 'OnPoint', y: 70, size: 36, weight: 'bold', fill: COLORS.accent },
    { text: attribution, y: 120, size: 26, fill: COLORS.textMuted },
    { text: `onpoint.fam/look/${lookSlug}`, y: 160, size: 22, fill: '#aaaaaa' },
  ], { bg: 'transparent' });

  // 7. Compose the full collage
  const collage = await sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 3,
      background: COLORS.bg,
    },
  })
    .composite([
      { input: headerBuffer, left: 0, top: 0 },
      ...gridComposites,
      ...heroBadges,
      { input: footerBuffer, left: 0, top: CARD_HEIGHT - FOOTER_HEIGHT },
    ])
    .webp({ quality: 88 })
    .toBuffer();

  // 8. Upload
  const r2Key = `looks/${lookSlug}/collage-${Date.now()}.webp`;
  await r2Upload(r2Key, collage, 'image/webp');

  return { r2Key, url: r2PublicUrl(r2Key) };
}

module.exports = {
  composeTryOnShareCard,
  composeLookCollage,
  // Backward-compatible alias
  generateShareCard: composeTryOnShareCard,
};
