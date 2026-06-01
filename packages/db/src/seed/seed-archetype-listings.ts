/**
 * Seed sample listings for all 6 curator archetypes.
 *
 * Each archetype gets 4-5 realistic inventory items with sizes, stock,
 * and pricing appropriate to their vertical and market.
 *
 * For Mo (sportswear), we reference existing PL kit_skus.
 * For other archetypes, we create new kit_skus entries that represent
 * their vertical's inventory (repurposing club/season/kitType fields).
 *
 * Run against Neon:
 *   NEON_DATABASE_URL=postgres://... npx tsx packages/db/src/seed/seed-archetype-listings.ts
 *
 * Or seed a single archetype:
 *   NEON_DATABASE_URL=postgres://... npx tsx packages/db/src/seed/seed-archetype-listings.ts zara
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { listings } from "../schema/listings.js";
import { kitSkus } from "../schema/kit-skus.js";

// ── Kit SKU definitions per archetype ────────────────────────────────
// For non-PL archetypes, we repurpose the kit_skus fields:
//   club     → brand / collection name
//   season   → "2024/25"
//   kitType  → "home" (default)
//
// The storefront renders these as labels, so "Nike Air Max 90 / Home kit"
// reads naturally as a product card title.

interface KitDef {
  id: string;
  club: string;
  season: string;
  kitType: "home" | "away" | "third" | "goalkeeper";
}

interface ListingDef {
  skuId: string;
  sizes: Array<{ size: string; stock: number; price: number }>;
}

// ── Zara (Streetwear) ───────────────────────────────────────────────
const ZARA_KITS: KitDef[] = [
  { id: "nike-air-max-90-2425-home", club: "Nike Air Max 90", season: "2024/25", kitType: "home" },
  { id: "adidas-originals-samba-2425-home", club: "Adidas Samba OG", season: "2024/25", kitType: "home" },
  { id: "new-balance-550-2425-home", club: "New Balance 550", season: "2024/25", kitType: "home" },
  { id: "carhartt-wip-pocket-tee-2425-home", club: "Carhartt WIP Pocket Tee", season: "2024/25", kitType: "home" },
  { id: "stussy-8-ball-fleece-2425-home", club: "Stüssy 8-Ball Fleece", season: "2024/25", kitType: "home" },
];

const ZARA_LISTINGS: ListingDef[] = [
  { skuId: "nike-air-max-90-2425-home", sizes: [
    { size: "EU 40", stock: 2, price: 14500 },
    { size: "EU 42", stock: 3, price: 14500 },
    { size: "EU 44", stock: 2, price: 14500 },
  ]},
  { skuId: "adidas-originals-samba-2425-home", sizes: [
    { size: "EU 39", stock: 1, price: 13000 },
    { size: "EU 41", stock: 4, price: 13000 },
    { size: "EU 43", stock: 3, price: 13000 },
  ]},
  { skuId: "new-balance-550-2425-home", sizes: [
    { size: "EU 40", stock: 2, price: 15000 },
    { size: "EU 42", stock: 3, price: 15000 },
    { size: "EU 44", stock: 1, price: 15000 },
  ]},
  { skuId: "carhartt-wip-pocket-tee-2425-home", sizes: [
    { size: "S", stock: 4, price: 4500 },
    { size: "M", stock: 6, price: 4500 },
    { size: "L", stock: 5, price: 4500 },
    { size: "XL", stock: 3, price: 4500 },
  ]},
  { skuId: "stussy-8-ball-fleece-2425-home", sizes: [
    { size: "M", stock: 2, price: 8500 },
    { size: "L", stock: 3, price: 8500 },
    { size: "XL", stock: 2, price: 8500 },
  ]},
];

// ── Amara (Ankara & African Print) ──────────────────────────────────
const AMARA_KITS: KitDef[] = [
  { id: "ankara-wrap-dress-2425-home", club: "Ankara Wrap Dress", season: "2024/25", kitType: "home" },
  { id: "ankara-maxi-skirt-2425-home", club: "Ankara Maxi Skirt", season: "2024/25", kitType: "home" },
  { id: "ankara-bubble-sleeve-blouse-2425-home", club: "Bubble Sleeve Blouse", season: "2024/25", kitType: "home" },
  { id: "ankara-kimono-set-2425-home", club: "Ankara Kimono Set", season: "2024/25", kitType: "home" },
  { id: "african-print-jumpsuit-2425-home", club: "African Print Jumpsuit", season: "2024/25", kitType: "home" },
];

const AMARA_LISTINGS: ListingDef[] = [
  { skuId: "ankara-wrap-dress-2425-home", sizes: [
    { size: "S", stock: 2, price: 6500 },
    { size: "M", stock: 3, price: 6500 },
    { size: "L", stock: 2, price: 6500 },
  ]},
  { skuId: "ankara-maxi-skirt-2425-home", sizes: [
    { size: "S", stock: 3, price: 4500 },
    { size: "M", stock: 4, price: 4500 },
    { size: "L", stock: 3, price: 4500 },
  ]},
  { skuId: "ankara-bubble-sleeve-blouse-2425-home", sizes: [
    { size: "S", stock: 2, price: 5000 },
    { size: "M", stock: 3, price: 5000 },
    { size: "L", stock: 2, price: 5000 },
  ]},
  { skuId: "ankara-kimono-set-2425-home", sizes: [
    { size: "M", stock: 2, price: 8000 },
    { size: "L", stock: 3, price: 8000 },
    { size: "XL", stock: 2, price: 8000 },
  ]},
  { skuId: "african-print-jumpsuit-2425-home", sizes: [
    { size: "S", stock: 1, price: 7500 },
    { size: "M", stock: 2, price: 7500 },
    { size: "L", stock: 2, price: 7500 },
  ]},
];

// ── Juma (Vintage & Thrift) ─────────────────────────────────────────
const JUMA_KITS: KitDef[] = [
  { id: "vintage-levis-501-2425-home", club: "Vintage Levi's 501", season: "2024/25", kitType: "home" },
  { id: "retro-nike Windbreaker-2425-home", club: "Retro Nike Windbreaker", season: "2024/25", kitType: "home" },
  { id: "thrift-denim-jacket-2425-home", club: "Thrift Denim Jacket", season: "2024/25", kitType: "home" },
  { id: "vintage-band-tee-2425-home", club: "Vintage Band Tee", season: "2024/25", kitType: "home" },
  { id: "retro-adidas-track-pants-2425-home", club: "Retro Adidas Track Pants", season: "2024/25", kitType: "home" },
];

const JUMA_LISTINGS: ListingDef[] = [
  { skuId: "vintage-levis-501-2425-home", sizes: [
    { size: "W30", stock: 1, price: 3500 },
    { size: "W32", stock: 2, price: 3500 },
    { size: "W34", stock: 1, price: 3500 },
  ]},
  { skuId: "retro-nike Windbreaker-2425-home", sizes: [
    { size: "M", stock: 1, price: 4500 },
    { size: "L", stock: 2, price: 4500 },
  ]},
  { skuId: "thrift-denim-jacket-2425-home", sizes: [
    { size: "S", stock: 1, price: 3000 },
    { size: "M", stock: 2, price: 3000 },
    { size: "L", stock: 1, price: 3000 },
  ]},
  { skuId: "vintage-band-tee-2425-home", sizes: [
    { size: "M", stock: 2, price: 2000 },
    { size: "L", stock: 3, price: 2000 },
    { size: "XL", stock: 1, price: 2000 },
  ]},
  { skuId: "retro-adidas-track-pants-2425-home", sizes: [
    { size: "S", stock: 1, price: 3500 },
    { size: "M", stock: 2, price: 3500 },
    { size: "L", stock: 2, price: 3500 },
  ]},
];

// ── Fatima (Tailor & Formalwear) ────────────────────────────────────
const FATIMA_KITS: KitDef[] = [
  { id: "custom-three-piece-suit-2425-home", club: "Custom Three-Piece Suit", season: "2024/25", kitType: "home" },
  { id: "slim-fit-dress-shirt-2425-home", club: "Slim Fit Dress Shirt", season: "2024/25", kitType: "home" },
  { id: "ankara-formal-blazer-2425-home", club: "Ankara Formal Blazer", season: "2024/25", kitType: "home" },
  { id: "custom-trousers-2425-home", club: "Custom Tailored Trousers", season: "2024/25", kitType: "home" },
  { id: "wedding-attire-set-2425-home", club: "Wedding Attire Set", season: "2024/25", kitType: "home" },
];

const FATIMA_LISTINGS: ListingDef[] = [
  { skuId: "custom-three-piece-suit-2425-home", sizes: [
    { size: "38R", stock: 1, price: 15000 },
    { size: "40R", stock: 2, price: 15000 },
    { size: "42R", stock: 1, price: 15000 },
  ]},
  { skuId: "slim-fit-dress-shirt-2425-home", sizes: [
    { size: "S", stock: 3, price: 4500 },
    { size: "M", stock: 4, price: 4500 },
    { size: "L", stock: 3, price: 4500 },
    { size: "XL", stock: 2, price: 4500 },
  ]},
  { skuId: "ankara-formal-blazer-2425-home", sizes: [
    { size: "M", stock: 2, price: 8500 },
    { size: "L", stock: 3, price: 8500 },
    { size: "XL", stock: 2, price: 8500 },
  ]},
  { skuId: "custom-trousers-2425-home", sizes: [
    { size: "30", stock: 2, price: 5000 },
    { size: "32", stock: 3, price: 5000 },
    { size: "34", stock: 2, price: 5000 },
    { size: "36", stock: 1, price: 5000 },
  ]},
  { skuId: "wedding-attire-set-2425-home", sizes: [
    { size: "38R", stock: 1, price: 25000 },
    { size: "40R", stock: 1, price: 25000 },
    { size: "42R", stock: 1, price: 25000 },
  ]},
];

// ── Grace (Luxury & Premium) ────────────────────────────────────────
const GRACE_KITS: KitDef[] = [
  { id: "designer-leather-tote-2425-home", club: "Designer Leather Tote", season: "2024/25", kitType: "home" },
  { id: "premium-cashmere-scarf-2425-home", club: "Cashmere Scarf", season: "2024/25", kitType: "home" },
  { id: "luxury-silk-blouse-2425-home", club: "Luxury Silk Blouse", season: "2024/25", kitType: "home" },
  { id: "designer-sunglasses-2425-home", club: "Designer Sunglasses", season: "2024/25", kitType: "home" },
  { id: "premium-leather-belt-2425-home", club: "Premium Leather Belt", season: "2024/25", kitType: "home" },
];

const GRACE_LISTINGS: ListingDef[] = [
  { skuId: "designer-leather-tote-2425-home", sizes: [
    { size: "One Size", stock: 2, price: 35000 },
  ]},
  { skuId: "premium-cashmere-scarf-2425-home", sizes: [
    { size: "One Size", stock: 3, price: 12000 },
  ]},
  { skuId: "luxury-silk-blouse-2425-home", sizes: [
    { size: "S", stock: 1, price: 18000 },
    { size: "M", stock: 2, price: 18000 },
    { size: "L", stock: 1, price: 18000 },
  ]},
  { skuId: "designer-sunglasses-2425-home", sizes: [
    { size: "One Size", stock: 2, price: 22000 },
  ]},
  { skuId: "premium-leather-belt-2425-home", sizes: [
    { size: "S (30-32)", stock: 2, price: 15000 },
    { size: "M (33-36)", stock: 3, price: 15000 },
    { size: "L (37-40)", stock: 2, price: 15000 },
  ]},
];

// ── Mo (Sportswear) — uses existing PL kit_skus ─────────────────────
// No new kit_skus needed; referencing arsenal-202425-home, etc.
const MO_LISTINGS: ListingDef[] = [
  // Subset of Wanja's SKUs — Mo carries different stock levels
  { skuId: "arsenal-202425-home", sizes: [
    { size: "S", stock: 3, price: 3200 },
    { size: "M", stock: 6, price: 3200 },
    { size: "L", stock: 5, price: 3200 },
    { size: "XL", stock: 2, price: 3200 },
  ]},
  { skuId: "chelsea-202425-home", sizes: [
    { size: "M", stock: 4, price: 2800 },
    { size: "L", stock: 3, price: 2800 },
    { size: "XL", stock: 2, price: 2800 },
  ]},
  { skuId: "liverpool-202425-home", sizes: [
    { size: "S", stock: 2, price: 3200 },
    { size: "M", stock: 5, price: 3200 },
    { size: "L", stock: 4, price: 3200 },
  ]},
  { skuId: "manchester-city-202425-home", sizes: [
    { size: "M", stock: 3, price: 3000 },
    { size: "L", stock: 4, price: 3000 },
    { size: "XL", stock: 2, price: 3000 },
  ]},
  { skuId: "tottenham-hotspur-202425-home", sizes: [
    { size: "M", stock: 2, price: 2800 },
    { size: "L", stock: 3, price: 2800 },
  ]},
];

// ── Archetype registry ──────────────────────────────────────────────
interface ArchetypeConfig {
  slug: string;
  kits: KitDef[];
  listings: ListingDef[];
}

const ARCHETYPES: ArchetypeConfig[] = [
  { slug: "mo", kits: [], listings: MO_LISTINGS }, // Uses existing PL kit_skus
  { slug: "zara", kits: ZARA_KITS, listings: ZARA_LISTINGS },
  { slug: "amara", kits: AMARA_KITS, listings: AMARA_LISTINGS },
  { slug: "juma", kits: JUMA_KITS, listings: JUMA_LISTINGS },
  { slug: "fatima", kits: FATIMA_KITS, listings: FATIMA_LISTINGS },
  { slug: "grace", kits: GRACE_KITS, listings: GRACE_LISTINGS },
];

async function main() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    console.error("NEON_DATABASE_URL is required");
    process.exit(1);
  }

  const targetSlug = process.argv[2]?.toLowerCase();
  const sql = neon(connectionString);
  const db = drizzle(sql, { schema: { listings, kitSkus } });

  const archetypes = targetSlug
    ? ARCHETYPES.filter((a) => a.slug === targetSlug)
    : ARCHETYPES;

  if (archetypes.length === 0) {
    console.error(`No archetype found with slug "${targetSlug}"`);
    console.error(`Available: ${ARCHETYPES.map((a) => a.slug).join(", ")}`);
    process.exit(1);
  }

  for (const archetype of archetypes) {
    console.log(`\n── ${archetype.slug} ──`);

    // Step 1: Insert kit SKUs (skip for mo — uses existing PL backbone)
    if (archetype.kits.length > 0) {
      console.log(`  Inserting ${archetype.kits.length} kit SKUs...`);
      for (const kit of archetype.kits) {
        await db.insert(kitSkus).values(kit).onConflictDoNothing();
      }
      console.log(`  ✓ Kit SKUs ready`);
    }

    // Step 2: Insert listings
    console.log(`  Inserting ${archetype.listings.length} listings...`);
    let inserted = 0;
    for (const item of archetype.listings) {
      try {
        await db.insert(listings).values({
          curatorSlug: archetype.slug,
          skuId: item.skuId,
          sizes: item.sizes,
          photoKeys: [],
          status: "live",
        });
        const minPrice = Math.min(...item.sizes.map((s) => s.price));
        console.log(`  ✓ ${item.skuId} — ${item.sizes.length} sizes, from KES ${minPrice.toLocaleString()}`);
        inserted++;
      } catch (err) {
        console.error(`  ✗ ${item.skuId} — ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(`  ${inserted}/${archetype.listings.length} listings created`);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
