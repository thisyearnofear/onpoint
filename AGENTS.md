# AGENTS.md — OnPoint Agent Commerce Guide

> **OnPoint** is the execution layer for fashion intent that needs fit, real stock, and local pay.
> Humans shop on branded storefronts with AI try-on. Agents hit the **same inventory** via API, x402 try-on, and on-chain checkout.
>
> **Live:** https://beonpoint.netlify.app · **API:** https://api.onpoint.famile.xyz · **Manifest:** https://beonpoint.netlify.app/.well-known/agent.json

---

## Base URLs

| Environment | URL |
|-------------|-----|
| Web app | https://beonpoint.netlify.app |
| API (Hetzner) | https://api.onpoint.famile.xyz |
| OpenAPI | https://beonpoint.netlify.app/openapi.json |
| Chain | Celo mainnet (chainId 42220) |
| Payment tokens | cUSD, USDC |
| x402 facilitator | https://api.x402.celo.org (EIP-3009, gasless) |

---

## What You Can Do

1. **Browse** curators and storefronts (free, no auth)
2. **Try on** items before buying ($0.03 digital, $0.05 physical, cUSD via x402)
3. **Buy** physical items from curator storefronts (cUSD on Celo)
4. **Earn referral commissions** — share links, earn 2.5% on purchases you drive
5. **Mint** fashion NFTs with 0xSplits royalties ($0.10)
6. **Check earnings** — public reconciled ledger per curator
7. **Create looks** — compose listings into shareable style boards, earn when they drive try-ons and purchases
8. **Get shareable collage cards** — try-on via a look generates an Instagram-ready collage with agent attribution

---

## The Flow (6 Steps)

### Step 1: Discover Curators

```bash
GET /api/curator/directory?agentPurchasable=1
```

Returns curators with `agentPurchasable: true` (payout wallet + live physical SKUs).

Key fields: `slug`, `agentPurchasable`, `agentCommerceEnabled`, `digitalTryOnEnabled`, `liveListingCount`.

### Step 2: Browse a Storefront

```bash
GET /api/curator/{slug}/storefront
```

Returns curator profile + live listings. Each listing includes `agentCommerce` with offers (size, stock, priceCusd). If `agentCommerce` is null, the curator has no wallet — cannot buy. Digital listings are try-on only.

### Step 3: Try On (Optional but Recommended)

```bash
POST /api/agent/try-on
{ "curatorSlug": "nia", "listingId": "abc123", "photoData": "data:image/jpeg;base64,..." }
```

Response: **HTTP 402** → pay cUSD fee → re-POST with `paymentTxHash` → **HTTP 200** with try-on render, fit signal, and polaroid (shareable artifact with `imageUrl` and `webUrl`).

Includes `revenueHint` showing economics. Digital listings also return `similarPhysicalItems`.

Full details: [docs/guides/agent-commerce.md](./docs/guides/agent-commerce.md)

### Step 4: Buy a Physical Item

```bash
POST /api/curator/{slug}/order
{ "listingId": "abc123", "size": "M", "quantity": 1 }
```

Response: **HTTP 402** → transfer cUSD to `payTo` (append `dataSuffix` for attribution) → re-POST with `paymentTxHash` + `quoteId` → **HTTP 201** with order confirmation, Celoscan links, a receipt at `/receipt/{receiptId}`, and storefront URL.

Also supports USDC via x402 facilitator (gasless) using `X-PAYMENT` header.

If purchase includes referral code (`X-Referral-Code` header or `?referral=` query param), referring agent earns 2.5% commission.

Full details: [docs/guides/agent-commerce.md](./docs/guides/agent-commerce.md)

### Step 5: Check Earnings (Public Ledger)

```bash
GET /api/curator/{slug}/earnings
```

Public reconciled ledger — try-on fees, order payouts, attribution tags.

### Step 6: Referral Tracking & Dashboard

Agents earn 2.5% commission on referred purchases. Include `X-Referral-Code` header or `?referral=` query param in order requests. View earnings at `/api/agent/dashboard` or the UI at `https://beonpoint.netlify.app/agent`.

Full details: [docs/guides/referral-tracking.md](./docs/guides/referral-tracking.md)

---

## Agent Looks

Anyone with a wallet can compose OnPoint listings into shareable **looks** (style boards) — external agents and human curators alike. A look is a curated set of items with a hero piece, a cover image, and tags. Each look has a public page at `/look/:slug` with try-on CTAs, item links, and share buttons.

### Create a Look

**Auth (two paths):**
1. **Agent**: `x-agent-address` header
2. **Curator**: `x-curator-slug` + `x-curator-whatsapp` headers (WhatsApp verification — the curator's wallet address is used as the creator)

```bash
# Agent auth
POST /api/looks
Headers: x-agent-address: 0x...
Body: {
  "title": "Weekend Street Fit",
  "description": "A relaxed weekend look...",
  "listingIds": ["uuid1", "uuid2", "uuid3"],
  "heroListingId": "uuid1",
  "tags": ["streetwear", "casual"],
  "coverImage": "data:image/jpeg;base64,..."  // optional
}

# Curator auth (human curators styling their own inventory)
POST /api/looks
Headers:
  x-curator-slug: zara
  x-curator-whatsapp: +254712345678
Body: { ... same as above ... }
```

Response: 201 with the created look (slug, id, etc.)

### Link an Agent to a Curator Storefront

A curator can link an agent wallet so that agent's looks appear on their storefront page. This is a soft link for attribution and discovery, not authorization.

```bash
POST /api/looks/curator/{slug}/link-agent
Body: { "whatsapp": "+254712345678", "agentAddress": "0x..." }
```

A curator can also set this to their own wallet to create looks themselves. UI for this is on the curator storefront page (owner-only panel).

### Discover Looks

Looks are discoverable through multiple paths:

1. **Storefront response** — `GET /api/curator/{slug}/storefront` now includes a `looks` array with the curator's 10 most recent live looks (slug, title, coverImageUrl, collageUrl, heroImageUrl, tags, metadata, tryOnCount, shareCount, itemCount). Single-call discovery — no separate API call needed.

2. **Agent manifest** — `/.well-known/agent.json` lists `"look_composition"` as a capability. Agents reading the manifest know looks exist.

3. **Direct API** — `GET /api/looks` with filters (see below).

### SDK Helpers

The `@repo/agent-core` package exports typed SDK functions for the looks API:

```typescript
import { browseLooks, getLook, createLook, classifyLook } from '@repo/agent-core';

// Browse with filters
const looks = await browseLooks({ category: 'streetwear', season: 'summer', limit: 10 });

// Get a single look with resolved items
const look = await getLook('weekend-street-fit-n19o');

// Create a look (requires auth headers on the agent-api client)
const { id, slug } = await createLook({
  title: 'Weekend Street Fit',
  listingIds: ['uuid1', 'uuid2', 'uuid3'],
  heroListingId: 'uuid1',
  tags: ['streetwear', 'casual'],
});

// Reclassify metadata
const { metadata } = await classifyLook('weekend-street-fit-n19o');
```

Also available: `updateLook`, `deleteLook`, `regenerateCollage`. See [`packages/agent-core/src/looks-api.ts`](./packages/agent-core/src/looks-api.ts) for full type definitions.

### Reference Script

```bash
node scripts/agent-looks.mjs browse --category=streetwear
node scripts/agent-looks.mjs get weekend-street-fit-n19o
node scripts/agent-looks.mjs create --title="..." --curator=zara --listings=u1,u2,u3 --dry-run
node scripts/agent-looks.mjs classify weekend-street-fit-n19o
```

### List & View Looks

```bash
GET /api/looks                    # list all live looks
GET /api/looks?curator=zara       # filter by curator
GET /api/looks?tag=streetwear     # filter by tag
GET /api/looks?agent=0x...        # filter by agent
GET /api/looks?category=streetwear  # filter by metadata.category
GET /api/looks?occasion=formal    # filter by metadata.occasion
GET /api/looks?season=summer      # filter by metadata.season
GET /api/looks?limit=50           # max results (capped at 100)
GET /api/looks/:slug              # get a look with resolved listings
```

### Look Metadata (Category, Occasion, Season)

Each look has a `metadata` field with structured classification:

```json
{
  "metadata": {
    "category": "streetwear",    // streetwear, casual, formal, event, sport, vintage, ankara, sustainable
    "occasion": "casual",        // casual, formal, event, sport, outdoor, travel, date-night
    "season": "all-season"       // spring, summer, fall, winter, all-season
  }
}
```

Metadata is auto-classified on look creation using a rule-based tag mapping (instant) with optional Qwen Cloud vision enhancement (best-effort). Reclassify on demand:

```bash
POST /api/looks/:slug/classify   # re-run classification, returns { success, metadata }
```

### Look Collages

Each look has a `collageUrl` — a composed image of all items in a styled flat-lay. The collage is generated automatically on look creation (fire-and-forget) and can be regenerated on demand:

```bash
POST /api/looks/:slug/collage    # regenerate collage, returns { r2Key, url, tier }
```

**Tier 2 (AI):** Uses Qwen Cloud `wan2.7-image-pro` for multi-image composition with a mood-aware prompt derived from the look title. Falls back to Tier 1 on any failure.

**Tier 1 (deterministic):** Uses `sharp` for a grid layout on a neutral background with title and attribution. Always works.

### Update & Manage Looks

```bash
PATCH /api/looks/:slug           # update title, description, tags, status (creator only)
DELETE /api/looks/:slug          # delete a look (creator only)
POST /api/looks/:slug/image      # upload cover image (creator only)
POST /api/looks/:slug/collage    # regenerate collage (public)
POST /api/looks/:slug/classify   # reclassify metadata (public)
POST /api/looks/:slug/share      # record a share event (public)
POST /api/looks/:slug/try-on-count  # increment try-on count (public)
POST /api/looks/bulk             # bulk archive/publish/delete (creator only)
```

**Bulk actions** — apply an action to multiple looks at once:
```bash
POST /api/looks/bulk
Headers: x-agent-address: 0x...
Body: { "action": "archive", "slugs": ["slug1", "slug2", "slug3"] }
# Response: { "updated": 3, "failed": [] }
```

**Drafts** — save incomplete looks and publish later:
```bash
POST /api/looks  Body: { ..., "status": "draft" }   # save as draft
PATCH /api/looks/:slug  Body: { "status": "live" }   # publish a draft
GET /api/looks?status=draft                          # list your drafts (auth-scoped)
```

**403 error format** — includes diagnostic context for self-correction:
```json
{
  "error": "Not the look owner",
  "provided": "0x123...",
  "expected": "0xabc...",
  "hint": "Use x-agent-address header with the wallet address that created this look, or use x-curator-slug + x-curator-whatsapp headers for curator auth."
}
```

### Try-On via a Look (Generates Share Card)

When a try-on includes `lookSlug`, the response includes a `shareCard` with an Instagram-ready 1080x1350 collage image:

```bash
POST /api/agent/try-on
{
  "curatorSlug": "zara",
  "listingId": "uuid1",
  "photoData": "data:image/jpeg;base64,...",
  "lookSlug": "weekend-street-fit-n19o"   // ← triggers share card generation
}
```

The share card includes:
- Hero: the try-on render (face + outfit)
- Strip: thumbnails of other items in the look
- Footer: "Styled by 0xABCD..." + OnPoint branding + look URL

The card is stored in R2 and returned as `shareCard.imageUrl`.

### Attribution

- Try-ons via a look increment the look's `tryOnCount`
- Purchases from a look page carry the agent's referral code (2.5% commission)
- Referral commissions are auto-settled by the payout worker every 30 minutes

---

## Pricing

| Action | Cost | Split |
|--------|------|-------|
| Browse directory + storefronts | Free | — |
| Web try-on (free tier) | Free (Venice SD35, rate-limited) | Platform subsidizes (~$0.015/call) |
| Digital try-on (agent, paid) | $0.03 cUSD | 80% curator / 20% platform |
| Physical try-on (agent, paid) | $0.05 cUSD | 95% curator / 5% platform |
| Physical order | Listing price (KES -> cUSD) | 95% curator / 5% platform |
| Referral commission | 2.5% of order value | Paid to referring agent |
| NFT mint | $0.10 cUSD | 85% creator / 15% platform |

### Two-Tier Try-On Quality

| Tier | Who | Model | Quality | Rate limit |
|------|-----|-------|---------|------------|
| Free (web) | Web users | Venice SD35 | Text-to-image "similar look" — not the actual garment | 5/min, 20/day per IP |
| Paid (agent) | Agents via x402 | Replicate IDM-VTON | Image-conditioned — actual garment on actual person | 5/min, 20/day per IP |

The free tier gives users a visual of "how they'd look in this style." The paid tier shows the actual garment on the person's photo — the accurate pre-purchase check. The quality gap is the reason to pay.

**Funnel analytics**: `GET /api/status/funnel?days=7` (service-key auth) — tracks try-on to purchase conversion, cost vs revenue per tier.

**Review deadline**: 2026-08-15 — decide whether to keep, kill, or adjust the free tier based on conversion data.

Per-curator try-on price can be overridden via `commerce.tryOnPriceUsd`. All payments in cUSD or USDC on Celo mainnet.

---

## Attribution (ERC-8021)

Every 402 response includes a `dataSuffix` in the `accepts` block. Append this to your payment transaction data. It carries the platform attribution code and assigned tag in an ERC-8021 array, which is how the hackathon leaderboard counts your transactions.

If you have your own attribution code, use `toDataSuffix(['your_code', 'celo_ce9e004195d5'])` — the assigned tag must be present.

---

## NFT Minting

```bash
POST /api/agent/mint
{ "userAddress": "0x...", "metadataUri": "ipfs://...", "royaltyRecipient": "0x..." }
```

Requires service auth (`x-service-key` header). Mints an OnPoint NFT (ERC-721A) with 0xSplits royalty (85% creator / 15% platform). Contract: `0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576` on Celo.

---

## Reference Implementation

```bash
# Dry run (no payment, just verifies the flow works)
node scripts/agent-buyer.mjs --dry-run

# Real purchase (needs cUSD + CELO for gas)
BUYER_PRIVATE_KEY=0x... node scripts/agent-buyer.mjs
```

---

## What Does NOT Need a Human Curator Wallet

| Capability | Needs curator wallet? | Notes |
|------------|---------------------|-------|
| Digital try-on (Nia) | No | Nia is platform-owned with custodial wallet |
| NFT minting | No | 85/15 split via 0xSplits |
| Browse storefront pages | No | `/s/{slug}` is browsable; WhatsApp checkout works |
| Agent physical orders | Yes | Requires `agentPurchasable` = wallet + live physical SKUs |
| Physical try-on to curator | Yes (or revenue goes to platform) | Without wallet, try-on fees default to platform |

---

## Agent Identity & Trust

- Curators are hidden from the agent directory until they self-serve a payout wallet
- `?includeInactive=1` shows all curators (admin use)
- Storefront pages (`/s/{slug}`) are loadable by slug regardless of wallet status
- Curator identity is trust-based: admin-seeded or self-applied via `/curator/onboard`

---

## Links

| Resource | URL |
|----------|-----|
| Strategy | [docs/STRATEGY.md](./docs/STRATEGY.md) |
| Architecture | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| OpenAPI contract | [apps/web/public/openapi.json](./apps/web/public/openapi.json) |
| Agent commerce guide | [docs/guides/agent-commerce.md](./docs/guides/agent-commerce.md) |
| Referral tracking guide | [docs/guides/referral-tracking.md](./docs/guides/referral-tracking.md) |
| Agent commerce ADR | [docs/adr/0010-agent-storefront-checkout.md](./docs/adr/0010-agent-storefront-checkout.md) |
| Digital curators ADR | [docs/adr/0011-erc8004-registration-and-digital-curators.md](./docs/adr/0011-erc8004-registration-and-digital-curators.md) |
| Pricing ADR | [docs/adr/0013-pricing-strategy-and-agent-revenue-model.md](./docs/adr/0013-pricing-strategy-and-agent-revenue-model.md) |
| x402 facilitator ADR | [docs/adr/0012-x402-facilitator-integration.md](./docs/adr/0012-x402-facilitator-integration.md) |
| Reference buyer | [scripts/agent-buyer.mjs](./scripts/agent-buyer.mjs) |
| Reference try-on | [scripts/agent-tryon.mjs](./scripts/agent-tryon.mjs) |
| Reference looks CLI | [scripts/agent-looks.mjs](./scripts/agent-looks.mjs) |
| Looks SDK | [packages/agent-core/src/looks-api.ts](./packages/agent-core/src/looks-api.ts) |
| Supply readiness check | [scripts/agent-commerce-ready.mjs](./scripts/agent-commerce-ready.mjs) |
| Curator imagery guide | [docs/guides/curator-imagery.md](./docs/guides/curator-imagery.md) |
