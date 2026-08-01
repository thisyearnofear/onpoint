/**
 * Seed digital curator + digital garment listings.
 *
 * Generates AI fashion designs via Venice SD35, uploads to the Hetzner
 * server for public serving, and inserts the curator + listings into Neon.
 *
 *   node scripts/seed-digital-curator.mjs
 *
 * Requires: VENICE_API_KEY, NEON_DATABASE_URL
 * Uses SSH to upload images to the server (snel-bot host).
 */

import { neon } from '@neondatabase/serverless';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const VENICE_API_KEY = process.env.VENICE_API_KEY;
const NEON_URL = process.env.NEON_DATABASE_URL;
const PUBLIC_BASE = 'https://api.onpoint.famile.xyz/digital-garments';

if (!VENICE_API_KEY) { console.error('VENICE_API_KEY required'); process.exit(1); }
if (!NEON_URL) { console.error('NEON_DATABASE_URL required'); process.exit(1); }

const sql = neon(NEON_URL);

// ── Digital curator: Nia ──────────────────────────────────────
const CURATOR = {
  slug: 'nia',
  name: 'Nia Digital',
  type: 'ai',
  verticals: ['football', 'streetwear', 'african-fashion', 'avant-garde'],
  channels: {},
  brand: {
    tagline: 'Reimagining African football culture through digital design',
    aesthetic: 'avant-garde sportswear',
  },
  commerce: {
    agentCommerceEnabled: true,
    revShare: 0.20,
    payoutModel: '0xSplits',
  },
};

// ── Digital garments to generate ──────────────────────────────
const GARMENTS = [
  {
    title: 'Arsenal Home — Ankara Reimagined',
    prompt: 'High-fashion editorial photograph of a football jersey design. Red and white Arsenal-inspired kit with traditional Ankara wax print patterns integrated into the fabric. Full-body mannequin display, studio lighting, white background, premium sportswear design concept.',
    tags: ['football', 'arsenal', 'home', 'african-fashion', 'ankara'],
  },
  {
    title: 'Chelsea Home — Indigo Wave',
    prompt: 'High-fashion editorial photograph of a football jersey design. Blue Chelsea-inspired kit with West African indigo dye patterns flowing across the chest. Full-body mannequin display, studio lighting, white background, premium sportswear design concept.',
    tags: ['football', 'chelsea', 'home', 'african-fashion', 'indigo'],
  },
  {
    title: 'Liverpool Away — Sahel Gold',
    prompt: 'High-fashion editorial photograph of a football jersey design. White and gold Liverpool-inspired away kit with Sahelian geometric gold embroidery patterns. Full-body mannequin display, studio lighting, white background, premium sportswear design concept.',
    tags: ['football', 'liverpool', 'away', 'african-fashion', 'sahel'],
  },
  {
    title: 'Man City Home — Kente Crown',
    prompt: 'High-fashion editorial photograph of a football jersey design. Sky blue Manchester City-inspired kit with Kente cloth strip patterns woven into the sleeves. Full-body mannequin display, studio lighting, white background, premium sportswear design concept.',
    tags: ['football', 'man-city', 'home', 'african-fashion', 'kente'],
  },
  {
    title: 'Arsenal Away — Mudcloth Minimal',
    prompt: 'High-fashion editorial photograph of a football jersey design. Black Arsenal-inspired away kit with minimalist Mali mudcloth (bogolanfini) patterns in earth tones. Full-body mannequin display, studio lighting, white background, premium sportswear design concept.',
    tags: ['football', 'arsenal', 'away', 'african-fashion', 'mudcloth'],
  },
  {
    title: 'Streetwear Bomber — Lagos Nights',
    prompt: 'High-fashion editorial photograph of a bomber jacket design. Matte black bomber with neon Lagos skyline silhouette printed on the back, silver hardware, techwear silhouette. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['streetwear', 'bomber', 'lagos', 'techwear'],
  },
  {
    title: 'Tracksuit — Accra Rush',
    prompt: 'High-fashion editorial photograph of a tracksuit design. Emerald green and black tracksuit with Adinkra symbol patterns subtly embossed on the jacket, athletic fit, premium materials. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['streetwear', 'tracksuit', 'accra', 'adinkra'],
  },
  {
    title: 'Jersey Dress — Nairobi Sunrise',
    prompt: 'High-fashion editorial photograph of a jersey dress design. Flowing athletic dress in sunrise orange and deep purple, inspired by Nairobi marathon culture, breathable mesh panels with Maasai beadwork pattern accents. Full-body mannequin display, studio lighting, white background, premium sportswear design concept.',
    tags: ['football', 'dress', 'nairobi', 'maasai', 'african-fashion'],
  },
  // ── SKU expansion (from research/manus — 20 new concepts) ────
  // Motif × garment × occasion matrix to keep the catalog fresh and varied.
  // Organized into 5 collection drops:
  //   Drop 1 "The Starting XI" — matchday + street silhouettes
  //   Drop 2 "Rhythm & Heat" — festival + rooftop brunch energy
  //   Drop 3 "Midnight Canvas" — date-night, darker palettes
  //   Drop 4 "Active Ancestry" — gym-focused heritage × performance
  //   Drop 5 "Accessories Pack" — low-barrier entry items
  {
    title: 'Lagos Adire Street',
    prompt: 'High-fashion editorial photograph of a bomber jacket design. Deep indigo base with white Adire resist-dye triangles and circular motifs, neon-pink piping, oversized silhouette. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['adire', 'bomber', 'lagos', 'street', 'african-fashion'],
  },
  {
    title: 'Accra Kente Matchday',
    prompt: 'High-fashion editorial photograph of a football kit design. Gold, emerald, and crimson Kente stripes in bold horizontal bands across a sleek black-trim jersey. Full-body mannequin display, studio lighting, white background, premium sportswear design concept.',
    tags: ['kente', 'football', 'accra', 'matchday', 'african-fashion'],
  },
  {
    title: 'Dakar Bogolan Festival',
    prompt: 'High-fashion editorial photograph of a bucket hat design. Earthy brown base with black mudcloth glyphs and symbols forming concentric circles around crown. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['bogolan', 'bucket-hat', 'dakar', 'festival', 'african-fashion'],
  },
  {
    title: 'Jozi Shweshwe Rooftop Brunch',
    prompt: 'High-fashion editorial photograph of a jersey dress design. Indigo and white Shweshwe lattice with circular motifs, A-line midi silhouette, airy jersey fabric. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['shweshwe', 'jersey-dress', 'jozi', 'rooftop-brunch', 'african-fashion'],
  },
  {
    title: 'Nairobi Kitenge Date-Night',
    prompt: 'High-fashion editorial photograph of a tracksuit design. Vibrant teal base with magenta and orange floral blocks on a sleek, tapered tracksuit with black piping. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['kitenge', 'tracksuit', 'nairobi', 'date-night', 'african-fashion'],
  },
  {
    title: 'Pretoria Ndebele Gym',
    prompt: 'High-fashion editorial photograph of a sneaker skin design. High-contrast Ndebele color blocks in red, blue, yellow on a performance sneaker skin with reflective accents. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['ndebele', 'sneaker-skin', 'pretoria', 'gym', 'african-fashion'],
  },
  {
    title: 'Abidjan Ankara Street',
    prompt: 'High-fashion editorial photograph of a phone-case skin design. Vibrant wax-print motif in magenta and lime on a matte phone skin, large-scale leaf shapes. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['ankara', 'phone-case-skin', 'abidjan', 'street', 'african-fashion'],
  },
  {
    title: 'Cape Town Shweshwe Matchday',
    prompt: 'High-fashion editorial photograph of a football kit design. Crisp white jersey with lilac Shweshwe geometries along sleeves and collar. Full-body mannequin display, studio lighting, white background, premium sportswear design concept.',
    tags: ['shweshwe', 'football', 'cape-town', 'matchday', 'african-fashion'],
  },
  {
    title: 'Bamako Bogolan Date-Night',
    prompt: 'High-fashion editorial photograph of a jersey dress design. Earthy cocoa base with beige mudcloth glyphs, asymmetric hem, subtle sheen. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['bogolan', 'jersey-dress', 'bamako', 'date-night', 'african-fashion'],
  },
  {
    title: 'Kumasi Kente Festival',
    prompt: 'High-fashion editorial photograph of a bomber jacket design. Royal gold and emerald Kente weaves on a black bomber with quilted shoulders and red piping. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['kente', 'bomber', 'kumasi', 'festival', 'african-fashion'],
  },
  {
    title: 'Ibadan Adire Date-Night',
    prompt: 'High-fashion editorial photograph of a jersey dress design. Midnight blue with tonal Adire swirls, asymmetrical hem, satin finish. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['adire', 'jersey-dress', 'ibadan', 'date-night', 'african-fashion'],
  },
  {
    title: 'Mombasa Kitenge Street',
    prompt: 'High-fashion editorial photograph of a bucket hat design. Neon pink and lime Kitenge blocks on reversible bucket hat, black base on reverse. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['kitenge', 'bucket-hat', 'mombasa', 'street', 'african-fashion'],
  },
  {
    title: 'Soweto Ndebele Festival',
    prompt: 'High-fashion editorial photograph of a tracksuit design. White nylon tracksuit with bold multi-color Ndebele chevrons down arms and legs. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['ndebele', 'tracksuit', 'soweto', 'festival', 'african-fashion'],
  },
  {
    title: 'Luanda Ankara Gym',
    prompt: 'High-fashion editorial photograph of a sneaker skin design. Red and yellow Ankara wax print across sneaker skins, black outsole, white side stripes. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['ankara', 'sneaker-skin', 'luanda', 'gym', 'african-fashion'],
  },
  {
    title: 'Kampala Kitenge Rooftop Brunch',
    prompt: 'High-fashion editorial photograph of a phone-case skin design. Pastel Kitenge blocks in mint and peach on phone skin with gradient border. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['kitenge', 'phone-case-skin', 'kampala', 'rooftop-brunch', 'african-fashion'],
  },
  {
    title: 'Kano Adire Gym',
    prompt: 'High-fashion editorial photograph of a scarf design. Lightweight infinity scarf in sky blue with tonal Adire resist-dye motifs, breathable viscose. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['adire', 'scarf', 'kano', 'gym', 'african-fashion'],
  },
  {
    title: 'Kigali Kitenge Gym',
    prompt: 'High-fashion editorial photograph of a sneaker skin design. Abstract kinetic Kitenge pattern in neon orange on high-top sneaker skins, black base. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['kitenge', 'sneaker-skin', 'kigali', 'gym', 'african-fashion'],
  },
  {
    title: 'Bulawayo Ndebele Rooftop Brunch',
    prompt: 'High-fashion editorial photograph of a jersey dress design. Sunset gradient with bold Ndebele borders in magenta and cobalt on a sleek jersey dress. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['ndebele', 'jersey-dress', 'bulawayo', 'rooftop-brunch', 'african-fashion'],
  },
  {
    title: 'Gaborone Shweshwe Street',
    prompt: 'High-fashion editorial photograph of a tracksuit design. Indigo Shweshwe with crisp white panels along arms and legs, technical fabric. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['shweshwe', 'tracksuit', 'gaborone', 'street', 'african-fashion'],
  },
  {
    title: 'Timbuktu Bogolan Date-Night',
    prompt: 'High-fashion editorial photograph of a bomber jacket design. Earthy browns with subtle mudcloth symbols across back and shoulders on a luxe leather bomber. Full-body mannequin display, studio lighting, white background, premium streetwear design concept.',
    tags: ['bogolan', 'bomber', 'timbuktu', 'date-night', 'african-fashion'],
  },

// ── Generate a single garment image via Venice SD35 ───────────
async function generateGarment(prompt) {
  const res = await fetch('https://api.venice.ai/api/v1/image/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'venice-sd35',
      prompt,
      width: 512,
      height: 768,
      format: 'webp',
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`Venice API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!data.images || !data.images[0]) throw new Error('No image in Venice response');
  return data.images[0]; // base64 data URI
}

// ── Upload to Hetzner server via SCP ──────────────────────────
function uploadToServer(base64DataUri, fileName) {
  const tmpPath = join(tmpdir(), fileName);
  const base64 = base64DataUri.replace(/^data:[^;]+;base64,/, '');
  writeFileSync(tmpPath, Buffer.from(base64, 'base64'));
  execSync(`scp "${tmpPath}" snel-bot:/opt/onpoint/apps/api/public/digital-garments/${fileName}`, { stdio: 'pipe' });
  return `${PUBLIC_BASE}/${fileName}`;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  // 1. Upsert curator
  await sql.query(`
    INSERT INTO curators (slug, name, type, verticals, channels, brand, commerce)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      verticals = EXCLUDED.verticals,
      brand = EXCLUDED.brand,
      commerce = EXCLUDED.commerce
  `, [
    CURATOR.slug, CURATOR.name, CURATOR.type,
    CURATOR.verticals, JSON.stringify(CURATOR.channels),
    JSON.stringify(CURATOR.brand), JSON.stringify(CURATOR.commerce),
  ]);
  console.log(`Curator upserted: ${CURATOR.slug}`);

  // 2. Check for existing digital listings to skip regeneration
  const existing = await sql`SELECT id, title FROM listings WHERE curator_slug = ${CURATOR.slug} AND inventory_type = 'digital'`;
  const existingTitles = new Set(existing.map(e => e.title));
  console.log(`Found ${existing.length} existing digital listings`);

  // 3. Generate + upload each garment, then insert listing
  for (const garment of GARMENTS) {
    if (existingTitles.has(garment.title)) {
      console.log(`Skipping (already exists): ${garment.title}`);
      continue;
    }

    console.log(`Generating: ${garment.title}...`);
    let imageDataUri;
    try {
      imageDataUri = await generateGarment(garment.prompt);
    } catch (err) {
      console.error(`  FAILED to generate: ${err.message}`);
      continue;
    }

    const listingId = crypto.randomUUID();
    const fileName = `${listingId}.webp`;

    console.log(`  Uploading to server...`);
    let publicUrl;
    try {
      publicUrl = uploadToServer(imageDataUri, fileName);
    } catch (err) {
      console.error(`  FAILED to upload: ${err.message}`);
      continue;
    }
    console.log(`  URL: ${publicUrl}`);

    // Insert digital listing
    await sql.query(`
      INSERT INTO listings (id, curator_slug, sku_id, inventory_type, sizes, photo_keys, title, tags, status)
      VALUES ($1, $2, NULL, 'digital', '[]', $3, $4, $5, 'live')
      ON CONFLICT (id) DO NOTHING
    `, [listingId, CURATOR.slug, [publicUrl], garment.title, garment.tags]);
    console.log(`  Listing created: ${listingId} — ${garment.title}`);
  }

  // 4. Summary
  const listings = await sql`SELECT id, title, tags FROM listings WHERE curator_slug = ${CURATOR.slug} AND inventory_type = 'digital'`;
  console.log(`\nDone! ${listings.length} digital listings for curator "${CURATOR.slug}"`);
  for (const l of listings) {
    console.log(`  ${l.id} — ${l.title} [${l.tags.join(', ')}]`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
