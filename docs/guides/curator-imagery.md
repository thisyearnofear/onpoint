# Curator Product Imagery Guide

> How to add product photos to curator storefront listings so they show real images instead of "Curator photo pending".

## Current state (2026-07-15)

| Curator | Listings | Photos | Notes |
|---------|----------|--------|-------|
| Zara | 5 physical | 5 | AI-generated (Venice SD35) — sneakers, hoodie, tee |
| Mo | 5 physical | 5 | AI-generated (Venice SD35) — football kit flat lays |
| Juma | 5 physical | 5 | 1 OSS (astro-shop shirt) + 4 AI-generated — vintage/thrift |
| Grace | 5 physical | 5 | 1 OSS (astro-shop shirt) + 4 AI-generated — luxury accessories |
| Nia | 8 digital | 8 | AI-generated garments — already had images |

**All 20 physical listings now have product images.** Human curator storefronts show a "Preview" badge and "Concept image" labels since the curators haven't been onboarded yet. Images were seeded via `scripts/seed-listing-images.mjs`.

## How listing images work

Each listing has two image sources, checked in order:

1. **`listing.photoKeys[]`** — curator-uploaded photos stored in R2. The first key becomes `imageUrl`.
2. **`kit.officialImageKey`** — a reference image from the kit SKU (e.g. an official product shot). Only football kits have this field populated.

The storefront route resolves `imageKey = listing.photoKeys[0] || kit.officialImageKey` and converts it to a public R2 URL.

## Three ways to add images

### Option 1: Admin UI (manual, per-listing)

1. Go to `https://beonpoint.netlify.app/admin/curators/{slug}/listings/{id}`
2. Upload a photo via the file picker — it base64-encodes and POSTs to the admin API
3. The image is uploaded to R2 and appended to `listing.photoKeys[]`
4. You can drag-and-drop reorder and delete photos

**Best for:** curators self-serving a few items, or admin fixing one listing.

### Option 2: Admin API (scriptable, batch)

```bash
# Upload a photo to a listing via the admin API
SERVICE_API_KEY=... curl -X POST \
  https://api.onpoint.famile.xyz/api/admin/curators/{slug}/listings/{id}/photos \
  -H "x-service-key: $SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"photo": "data:image/jpeg;base64,/9j/4AAQ..."}'
```

The API accepts base64 data URIs (max 10MB). The photo is stored in R2 at `listings/{slug}/{listingId}/{n}.jpg` and appended to `photoKeys`.

**Best for:** batch-uploading many images from a script.

### Option 3: WhatsApp ingest (curator self-serve)

Curators can send a photo + listing details via WhatsApp to the OnPoint agent number. The `whatsapp-ingest.js` route parses the message and attaches the photo to the matching listing.

**Best for:** ongoing operations — curators send photos as they stock new items.

## Image requirements

- **Format:** JPEG, PNG, or WebP
- **Max size:** 10MB
- **Recommended dimensions:** 1200×900 (4:3 aspect ratio to match the storefront card)
- **Content:** Product on a clean background (white or neutral), well-lit, full item visible
- **R2 public URL pattern:** `https://pub-9e9f819de7054860b4755c940999f1fd.r2.dev/{key}`

## Mo's football kit images (special case)

Mo's 5 listings have `officialImageKey` populated (e.g. `kits/arsenal-202425-home.jpg`) but the actual files don't exist in R2 — they were referenced in the seed data but never uploaded.

To fix these, either:
- **Upload official kit images** to R2 at the expected keys (e.g. `kits/arsenal-202425-home.jpg`)
- **Or upload curator photos** via the admin API, which will take precedence over `officialImageKey`

## Batch upload script (template)

```bash
#!/bin/bash
# Upload images to curator listings in batch.
# Requires: SERVICE_API_KEY, image files named by listing ID.

SERVICE_API_KEY="${SERVICE_API_KEY:?Set SERVICE_API_KEY}"
API="https://api.onpoint.famile.xyz"

# Example: upload photos for Zara's listings
declare -A LISTINGS=(
  ["9cc61afc-35fd-4ddf-97a6-09bea7c5ef41"]="stussy-8ball.jpg"
  ["b0484b55-8d61-4581-a78f-f47339ae8be1"]="carhartt-tee.jpg"
  # ... etc
)

for listing_id in "${!LISTINGS[@]}"; do
  img="${LISTINGS[$listing_id]}"
  echo "Uploading $img → zara/$listing_id..."
  base64=$(base64 -i "$img")
  curl -s -X POST \
    "$API/api/admin/curators/zara/listings/$listing_id/photos" \
    -H "x-service-key: $SERVICE_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"photo\": \"data:image/jpeg;base64,$base64\"}" | jq .r2Key
done
```

## Verifying

After uploading, check the storefront:

```bash
# Check a curator's storefront for image URLs
curl -s https://api.onpoint.famile.xyz/api/curator/zara/storefront | \
  jq '.listings[] | {id: .id[0:12], title: .kit.club, imageUrl}'
```

Each listing should now have a non-null `imageUrl`. The storefront at `https://beonpoint.netlify.app/s/zara` will show real product photos instead of the "Curator photo pending" placeholder.

## Priority order

1. **Mo** (football kits) — highest conversion potential; official kit images are well-known and easy to source
2. **Zara** (streetwear/sneakers) — recognizable brands, easy to photograph or source
3. **Juma** (vintage/thrift) — each item is unique, needs actual photos
4. **Grace** (luxury accessories) — premium audience expects polished imagery
