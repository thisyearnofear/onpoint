/**
 * Seed: Meridian Goods digital stadium poster — a PURCHASABLE digital good.
 *
 * Digital listings are normally try-on-only; a listing carrying
 * attributes.deliverableKey + attributes.priceUsd is orderable and delivered
 * as a download (see the order route's digitalOrder path). The deliverable is
 * a real file in R2, public via R2_PUBLIC_URL.
 *
 *   node scripts/seed-meridian-poster.mjs
 *
 * Requires: NEON_DATABASE_URL + R2 creds (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *   R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL) — present in the
 *   prod api env; run with them env'd in locally or on the server.
 */
import { neon } from '@neondatabase/serverless';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const NEON_URL = process.env.NEON_DATABASE_URL;
if (!NEON_URL) { console.error('NEON_DATABASE_URL required'); process.exit(1); }
const sql = neon(NEON_URL);

const SLUG = 'meridian';
const POSTER_KEY = 'deliverables/meridian-stadium-poster.svg';
const PRICE_USD = 4.99;

// A real poster — committed flat design, no marks/crests/sponsors.
// Floodlit night stadium, poster-grade halftone sun, heavy display type.
const POSTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1128"/><stop offset="0.6" stop-color="#12294d"/><stop offset="1" stop-color="#1a3a5c"/>
    </linearGradient>
    <radialGradient id="moon" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#f5f0d8"/><stop offset="0.75" stop-color="#f5f0d8"/><stop offset="0.78" stop-color="#f5f0d800"/>
    </radialGradient>
    <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="7" cy="7" r="2.4" fill="#0a1128" opacity="0.55"/>
    </pattern>
  </defs>
  <rect width="1200" height="1600" fill="url(#sky)"/>
  <circle cx="600" cy="420" r="190" fill="url(#moon)"/>
  <circle cx="600" cy="420" r="170" fill="#f5f0d8"/>
  <circle cx="600" cy="420" r="170" fill="url(#dots)"/>
  <!-- floodlight masts -->
  <g stroke="#f5f0d8" stroke-width="6" opacity="0.9">
    <line x1="150" y1="640" x2="150" y2="380"/><line x1="1050" y1="640" x2="1050" y2="380"/>
  </g>
  <g fill="#f5f0d8">
    <circle cx="120" cy="366" r="12"/><circle cx="150" cy="352" r="12"/><circle cx="180" cy="366" r="12"/>
    <circle cx="1020" cy="366" r="12"/><circle cx="1050" cy="352" r="12"/><circle cx="1080" cy="366" r="12"/>
  </g>
  <g opacity="0.28" fill="#f5f0d8">
    <polygon points="120,366 60,640 240,640"/><polygon points="1080,366 1140,640 960,640"/>
  </g>
  <!-- stands -->
  <rect x="0" y="640" width="1200" height="240" fill="#0d1d38"/>
  <g fill="#f5f0d8" opacity="0.5">
    ${Array.from({length: 11}, (_, r) => Array.from({length: 40}, (_, c) => `<circle cx="${15 + c * 30 + (r % 2) * 15}" cy="${665 + r * 19}" r="4"/>`).join('')).join('')}
  </g>
  <!-- pitch -->
  <rect x="0" y="880" width="1200" height="720" fill="#14512e"/>
  <g stroke="#f5f0d8" stroke-width="5" fill="none" opacity="0.85">
    <rect x="60" y="940" width="1080" height="600"/>
    <line x1="600" y1="940" x2="600" y2="1540"/>
    <circle cx="600" cy="1240" r="110"/>
    <rect x="330" y="940" width="540" height="160"/><rect x="330" y="1380" width="540" height="160"/>
  </g>
  <g fill="#14512e" opacity="0.35">
    <rect x="60" y="940" width="1080" height="75"/><rect x="60" y="1090" width="1080" height="75"/>
    <rect x="60" y="1240" width="1080" height="75"/><rect x="60" y="1390" width="1080" height="75"/>
  </g>
  <!-- typography -->
  <text x="600" y="140" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="92" font-weight="900" fill="#f5f0d8" letter-spacing="6">MERIDIAN</text>
  <text x="600" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" fill="#f5f0d8" letter-spacing="14">FOOTBALL CLUB</text>
  <text x="600" y="1560" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#f5f0d8" letter-spacing="8" opacity="0.85">SATURDAY NIGHTS UNDER LIGHTS</text>
</svg>`;

const { upload, publicUrl } = require('../apps/api/node_modules/@repo/storage/dist/index.cjs');

async function main() {
  console.log('Uploading poster to R2 →', POSTER_KEY);
  await upload(POSTER_KEY, Buffer.from(POSTER_SVG, 'utf8'), 'image/svg+xml');
  console.log('  public URL:', publicUrl ? publicUrl(POSTER_KEY) : '(R2_PUBLIC_URL unset — check env)');

  const id = crypto.randomUUID();
  const [curator] = await sql`SELECT slug FROM curators WHERE slug = ${SLUG}`;
  if (!curator) { console.error(`curator "${SLUG}" missing`); process.exit(1); }

  const existing = await sql`SELECT id FROM listings WHERE curator_slug = ${SLUG} AND title = 'Meridian FC — Saturday Nights Poster'`;
  if (existing.length) {
    console.log('poster listing already exists:', existing[0].id);
    return;
  }

  await sql`
    INSERT INTO listings (id, curator_slug, sku_id, inventory_type, sizes, photo_keys, title, tags, attributes, status, last_verified_at)
    VALUES (
      ${id}, ${SLUG}, NULL, 'digital', '[]'::jsonb,
      ${[POSTER_KEY]}, 'Meridian FC — Saturday Nights Poster',
      ${['football', 'poster', 'digital-download']},
      ${JSON.stringify({
        type: 'poster',
        deliverableKey: POSTER_KEY,
        fileName: 'meridian-stadium-poster.svg',
        priceUsd: PRICE_USD,
      })}::jsonb,
      'live', NOW()
    )
  `;
  console.log(`Inserted digital poster listing ${id} — priceUsd ${PRICE_USD}, deliverable ${POSTER_KEY}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
