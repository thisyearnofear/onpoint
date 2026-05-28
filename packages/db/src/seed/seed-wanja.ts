/**
 * Seed Wanja — curator profile + top 10 jersey listings.
 *
 * Wanja is a sole trader selling Premier League jerseys via WhatsApp in Kenya.
 * This script seeds her curator profile and 10 listings referencing the
 * existing PL backbone kit_skus (60 rows from pl-backbone.ts).
 *
 * Run against Neon:
 *   NEON_DATABASE_URL=postgres://... npx tsx packages/db/src/seed/seed-wanja.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { curators } from "../schema/curators.js";
import { listings } from "../schema/listings.js";
import { kitSkus } from "../schema/kit-skus.js";

/**
 * Wanja's top 10 best-selling SKUs — popular PL clubs, sizes she carries,
 * and her KES pricing.
 *
 * These are realistic for the Kenyan market: replica jerseys typically
 * sell for KES 2,500–5,000 depending on club popularity and kit type.
 */
const TOP_TEN_SKUS: Array<{
  skuId: string;
  sizes: Array<{ size: string; stock: number; price: number }>;
}> = [
  // 1. Arsenal home — Wanja's best seller
  { skuId: "arsenal-202425-home", sizes: [{ size: "S", stock: 2, price: 3500 }, { size: "M", stock: 5, price: 3500 }, { size: "L", stock: 4, price: 3500 }, { size: "XL", stock: 3, price: 3500 }] },
  // 2. Arsenal away
  { skuId: "arsenal-202425-away", sizes: [{ size: "M", stock: 3, price: 3500 }, { size: "L", stock: 4, price: 3500 }, { size: "XL", stock: 2, price: 3500 }] },
  // 3. Arsenal third (popular yellow/green third kit)
  { skuId: "arsenal-202425-third", sizes: [{ size: "M", stock: 2, price: 4000 }, { size: "L", stock: 3, price: 4000 }] },
  // 4. Chelsea home
  { skuId: "chelsea-202425-home", sizes: [{ size: "S", stock: 1, price: 3000 }, { size: "M", stock: 4, price: 3000 }, { size: "L", stock: 3, price: 3000 }] },
  // 5. Chelsea away
  { skuId: "chelsea-202425-away", sizes: [{ size: "M", stock: 2, price: 3000 }, { size: "L", stock: 3, price: 3000 }] },
  // 6. Liverpool home
  { skuId: "liverpool-202425-home", sizes: [{ size: "S", stock: 3, price: 3500 }, { size: "M", stock: 6, price: 3500 }, { size: "L", stock: 5, price: 3500 }, { size: "XL", stock: 2, price: 3500 }] },
  // 7. Liverpool away
  { skuId: "liverpool-202425-away", sizes: [{ size: "M", stock: 3, price: 3500 }, { size: "L", stock: 2, price: 3500 }] },
  // 8. Manchester United home
  { skuId: "manchester-united-202425-home", sizes: [{ size: "S", stock: 2, price: 3500 }, { size: "M", stock: 4, price: 3500 }, { size: "L", stock: 4, price: 3500 }] },
  // 9. Manchester City home
  { skuId: "manchester-city-202425-home", sizes: [{ size: "M", stock: 3, price: 3000 }, { size: "L", stock: 3, price: 3000 }, { size: "XL", stock: 1, price: 3000 }] },
  // 10. Tottenham Hotspur home
  { skuId: "tottenham-hotspur-202425-home", sizes: [{ size: "M", stock: 2, price: 3000 }, { size: "L", stock: 3, price: 3000 }] },
];

async function main() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    console.error("NEON_DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(connectionString);
  const db = drizzle(sql, { schema: { curators, listings, kitSkus } });

  // ── Step 1: Insert Wanja's curator profile ──
  console.log("Seeding Wanja curator profile...");

  await db
    .insert(curators)
    .values({
      slug: "wanja",
      name: "Wanja",
      type: "human",
      verticals: ["football", "sportswear", "premier-league"],
      channels: {
        whatsapp: "+254712345678", // placeholder — confirmed on call
        instagram: "@wanja.jerseys",
      },
      brand: {
        colors: { primary: "#1a1a2e", accent: "#e94560" },
        shareCopy: "Hit me up on WhatsApp to order your {club} {kit_type} kit! — Wanja",
        location: { city: "Nairobi", landmark: "Kenya" },
      },
      commerce: {
        checkout: "whatsapp",
        whatsappTemplate: "Hi Wanja, I'd like to order the {club} {kit_type} kit in size {size} — KES {price}",
        revShare: 0.05,
      },
    })
    .onConflictDoNothing();

  console.log("  ✓ Wanja curator profile created");

  // ── Step 2: Insert 10 listings ──
  console.log("Seeding 10 listings...");

  let inserted = 0;
  for (const item of TOP_TEN_SKUS) {
    try {
      await db
        .insert(listings)
        .values({
          curatorSlug: "wanja",
          skuId: item.skuId,
          sizes: item.sizes,
          photoKeys: [],
          status: "live",
        })
      console.log(`  ✓ ${item.skuId} — ${item.sizes.length} sizes, from KES ${Math.min(...item.sizes.map(s => s.price))}`);
      inserted++;
    } catch (err) {
      console.error(`  ✗ ${item.skuId} — ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nDone. ${inserted}/10 listings created for Wanja.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
