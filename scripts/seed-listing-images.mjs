#!/usr/bin/env node
/**
 * Batch upload product images for physical curator listings.
 *
 * Hybrid approach:
 *   - Uses OSS images from codrops/astro-shop-view-transitions where they fit
 *   - AI-generates the rest via Venice SD35 with product-specific prompts
 *   - Uploads all images to R2 via the admin API
 *
 * Usage:
 *   node scripts/seed-listing-images.mjs
 *
 * Env:
 *   VENICE_API_KEY    Venice API key for image generation
 *   SERVICE_API_KEY   OnPoint admin API key
 *   ONPOINT_API       API base (default https://api.onpoint.famile.xyz)
 */

const VENICE_API_KEY = process.env.VENICE_API_KEY;
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;
const API_BASE = (process.env.ONPOINT_API || "https://api.onpoint.famile.xyz").replace(/\/$/, "");

if (!SERVICE_API_KEY) { console.error("✗ SERVICE_API_KEY required"); process.exit(1); }

// ── Listing data with image strategy ──────────────────────────
// Each entry: { slug, listingId, name, strategy, prompt?, ossUrl? }
// strategy: "oss" = download from OSS repo, "ai" = generate via Venice

const LISTINGS = [
  // ── Zara (streetwear/sneakers) ──
  {
    slug: "zara",
    listingId: "9cc61afc-35fd-4ddf-97a6-09bea7c5ef41",
    name: "Stüssy 8-Ball Fleece",
    strategy: "ai",
    prompt: "Professional product photograph of a black fleece hoodie with 8-ball graphic on chest, streetwear style, folded on neutral background, studio lighting, e-commerce product shot, high detail.",
  },
  {
    slug: "zara",
    listingId: "b0484b55-8d61-4581-a78f-f47339ae8be1",
    name: "Carhartt WIP Pocket Tee",
    strategy: "oss",
    ossUrl: "https://raw.githubusercontent.com/codrops/astro-shop-view-transitions/master/public/products/haryo-setyadi-acn5ERAeSb4-unsplash.webp",
  },
  {
    slug: "zara",
    listingId: "5e296589-4f18-4306-b1e6-5130b15ba991",
    name: "New Balance 550",
    strategy: "ai",
    prompt: "Professional product photograph of a white and grey New Balance 550 sneaker, side profile, on clean white background, studio lighting, e-commerce product shot, high detail.",
  },
  {
    slug: "zara",
    listingId: "fa4635a3-9f3a-4cf1-8ee3-93f2df73eaf5",
    name: "Adidas Samba OG",
    strategy: "ai",
    prompt: "Professional product photograph of a black and white Adidas Samba OG sneaker with gum sole, side profile, on clean white background, studio lighting, e-commerce product shot, high detail.",
  },
  {
    slug: "zara",
    listingId: "456af0af-5c9e-4b8a-87e3-87f594af5899",
    name: "Nike Air Max 90",
    strategy: "ai",
    prompt: "Professional product photograph of a grey and white Nike Air Max 90 sneaker, side profile, on clean white background, studio lighting, e-commerce product shot, high detail.",
  },

  // ── Mo (football kits) ──
  {
    slug: "mo",
    listingId: "82d8e6c5-02b7-412e-ac57-c64d200c039e",
    name: "Arsenal Home Kit",
    strategy: "ai",
    prompt: "Professional product photograph of a red and white Arsenal football jersey, 2024/25 home kit, flat lay on neutral background, studio lighting, e-commerce product shot.",
  },
  {
    slug: "mo",
    listingId: "73127198-8cef-4b94-9e38-cafd3b8e61f3",
    name: "Chelsea Home Kit",
    strategy: "ai",
    prompt: "Professional product photograph of a blue Chelsea football jersey, 2024/25 home kit, flat lay on neutral background, studio lighting, e-commerce product shot.",
  },
  {
    slug: "mo",
    listingId: "b79b6a43-f908-417a-a0e7-91cc7eaba6ef",
    name: "Liverpool Home Kit",
    strategy: "ai",
    prompt: "Professional product photograph of a red Liverpool football jersey, 2024/25 home kit, flat lay on neutral background, studio lighting, e-commerce product shot.",
  },
  {
    slug: "mo",
    listingId: "8a466bb0-c175-4dce-b6fa-32cca847abac",
    name: "Manchester City Home Kit",
    strategy: "ai",
    prompt: "Professional product photograph of a sky blue Manchester City football jersey, 2024/25 home kit, flat lay on neutral background, studio lighting, e-commerce product shot.",
  },
  {
    slug: "mo",
    listingId: "0a06406f-5e0d-4010-ad34-16acb581f423",
    name: "Tottenham Home Kit",
    strategy: "ai",
    prompt: "Professional product photograph of a white Tottenham Hotspur football jersey, 2024/25 home kit, flat lay on neutral background, studio lighting, e-commerce product shot.",
  },

  // ── Juma (vintage/thrift) ──
  {
    slug: "juma",
    listingId: "1479b9ae-a302-4e02-becd-cf12864c5119",
    name: "Retro Adidas Track Pants",
    strategy: "ai",
    prompt: "Professional product photograph of vintage retro black Adidas track pants with three stripes, folded on neutral background, studio lighting, e-commerce thrift store product shot.",
  },
  {
    slug: "juma",
    listingId: "eef91e1c-6c00-4677-b611-a8ed20b7ac2e",
    name: "Vintage Band Tee",
    strategy: "oss",
    ossUrl: "https://raw.githubusercontent.com/codrops/astro-shop-view-transitions/master/public/products/faith-yarn-Wr0TpKqf26s-unsplash.webp",
  },
  {
    slug: "juma",
    listingId: "29df4c30-7d60-4758-9f7f-f8f0aa14a573",
    name: "Thrift Denim Jacket",
    strategy: "ai",
    prompt: "Professional product photograph of a vintage blue denim jacket, folded on neutral background, studio lighting, e-commerce thrift store product shot, high detail.",
  },
  {
    slug: "juma",
    listingId: "c30ec991-33bd-4b5c-ad44-6747dc8cf82c",
    name: "Retro Nike Windbreaker",
    strategy: "ai",
    prompt: "Professional product photograph of a retro 90s Nike windbreaker jacket in bright colors, folded on neutral background, studio lighting, e-commerce thrift store product shot.",
  },
  {
    slug: "juma",
    listingId: "99d75f6d-022d-4c37-8943-1b4002c5e7fb",
    name: "Vintage Levi's 501",
    strategy: "ai",
    prompt: "Professional product photograph of vintage Levi's 501 blue jeans, folded on neutral background, studio lighting, e-commerce thrift store product shot, high detail.",
  },

  // ── Grace (luxury accessories) ──
  {
    slug: "grace",
    listingId: "905106f3-5ea1-41a7-b239-81d0f3965799",
    name: "Premium Leather Belt",
    strategy: "ai",
    prompt: "Professional product photograph of a premium black leather belt with silver buckle, coiled on white background, studio lighting, luxury e-commerce product shot, high detail.",
  },
  {
    slug: "grace",
    listingId: "bb830d4b-1793-4e76-8fce-f1b6d02b76b9",
    name: "Designer Sunglasses",
    strategy: "ai",
    prompt: "Professional product photograph of luxury designer sunglasses, black frame, on white background, studio lighting, luxury e-commerce product shot, high detail.",
  },
  {
    slug: "grace",
    listingId: "2cf2784e-b2ec-4ca9-819c-812c2ce69069",
    name: "Luxury Silk Blouse",
    strategy: "oss",
    ossUrl: "https://raw.githubusercontent.com/codrops/astro-shop-view-transitions/master/public/products/ryan-hoffman-A7f7XRKgUWc-unsplash.webp",
  },
  {
    slug: "grace",
    listingId: "6bbfd958-d859-4f33-8617-9691d74a3530",
    name: "Cashmere Scarf",
    strategy: "ai",
    prompt: "Professional product photograph of a folded luxury cashmere scarf in camel beige, on white background, studio lighting, luxury e-commerce product shot, high detail.",
  },
  {
    slug: "grace",
    listingId: "9b4f8d1d-cc23-49dc-8ab1-24e0634a1498",
    name: "Designer Leather Tote",
    strategy: "ai",
    prompt: "Professional product photograph of a luxury tan leather tote bag, on white background, studio lighting, luxury e-commerce product shot, high detail.",
  },
];

// ── Helpers ───────────────────────────────────────────────────

async function downloadOss(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = url.endsWith(".webp") ? "webp" : url.endsWith(".png") ? "png" : "jpg";
  const mime = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function generateAi(prompt) {
  if (!VENICE_API_KEY) throw new Error("VENICE_API_KEY required for AI generation");
  const res = await fetch("https://api.venice.ai/api/v1/image/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VENICE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "venice-sd35",
      prompt,
      width: 768,
      height: 768,
      format: "webp",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Venice API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!data.images?.[0]) throw new Error("No image in Venice response");
  return data.images[0]; // base64 data URI
}

async function uploadToAdminApi(slug, listingId, base64Data) {
  const res = await fetch(
    `${API_BASE}/api/admin/curators/${slug}/listings/${listingId}/photos`,
    {
      method: "POST",
      headers: {
        "x-service-key": SERVICE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ photo: base64Data }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Admin API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.r2Key;
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log(`\n📋 Seeding product images for ${LISTINGS.length} listings\n`);
  console.log(`   OSS:  ${LISTINGS.filter((l) => l.strategy === "oss").length} listings`);
  console.log(`   AI:   ${LISTINGS.filter((l) => l.strategy === "ai").length} listings\n`);

  let success = 0;
  let failed = 0;
  const errors = [];

  for (const listing of LISTINGS) {
    const label = `${listing.slug}/${listing.name}`;
    process.stdout.write(`  ${label}... `);

    try {
      // Step 1: Get the image (OSS or AI)
      let base64Data;
      if (listing.strategy === "oss") {
        base64Data = await downloadOss(listing.ossUrl);
        process.stdout.write(`downloaded → `);
      } else {
        base64Data = await generateAi(listing.prompt);
        process.stdout.write(`generated → `);
      }

      // Step 2: Upload to admin API
      const r2Key = await uploadToAdminApi(listing.slug, listing.listingId, base64Data);
      console.log(`✓ ${r2Key}`);
      success++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      errors.push({ listing: label, error: err.message });
      failed++;
    }

    // Small delay between Venice calls to avoid rate limiting
    if (listing.strategy === "ai") {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log(`\n📊 Results: ${success} succeeded, ${failed} failed`);
  if (errors.length > 0) {
    console.log("\n❌ Errors:");
    for (const e of errors) console.log(`   ${e.listing}: ${e.error}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
