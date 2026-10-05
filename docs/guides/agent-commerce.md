# Agent Commerce Guide

> Buy fit-aware fashion from OnPoint curator inventory via x402 / cUSD on Celo.
> Product vision: [STRATEGY.md](../STRATEGY.md) · Spec: [ADR 0010](../adr/0010-agent-storefront-checkout.md)

## Quick path

1. **Discover** — `GET /api/curator/directory?agentPurchasable=1`  
   Prefer curators with `agentPurchasable: true` (wallet + live physical SKUs).  
   `agentCommerceEnabled` alone means wallet only — may have zero offers.
2. **Catalog** — `GET /api/curator/{slug}/storefront`  
   Physical listings with stock expose `agentCommerce.offers` (size, stock, `priceCusd`).  
   Digital listings are try-on only (`inventoryType: "digital"`).
3. **Optional fit** — `POST /api/agent/try-on`  
   Body: `{ curatorSlug, listingId, photoData }` → HTTP 402 → pay cUSD by default, or use an eligible gasless USDC facilitator challenge via `X-PAYMENT` → re-POST.
   Response includes fit signal / recommended size; digital try-ons may return `similarPhysicalItems`. This facilitator option applies to eligible try-on requests, not physical order checkout.
4. **Buy** — `POST /api/curator/{slug}/order`  
   `{ listingId, size, quantity }` → 402 → transfer exact cUSD to `payTo` (append attribution `dataSuffix` if provided) → re-POST with `paymentTxHash` (+ `quoteId`).  
   `201` includes order + Celoscan links; curator is paid on-chain. The current order route accepts cUSD via `paymentTxHash`; it rejects `X-PAYMENT`/USDC facilitator checkout until treasury conversion and liquidity policy are explicitly enabled.
5. **Earn referrals** — Pass `X-Referral-Code` header or `?referral=` query param to earn 2.5% commission on referred purchases.
6. **Create looks** — Compose listings into shareable style boards (`POST /api/looks`). Each look has a public page at `/look/:slug` with try-on CTAs and share buttons.
7. **Dashboard** — `GET /api/agent/dashboard` to view wallet health, referral earnings, and activity.
8. **Earnings** — `GET /api/curator/{slug}/earnings` (public ledger).

Base API (production): `https://api.onpoint.famile.xyz`  
Manifest: [`/.well-known/agent.json`](../../apps/web/public/.well-known/agent.json)  
Reference buyer: [`scripts/agent-buyer.mjs`](../../scripts/agent-buyer.mjs)  
Reference try-on: [`scripts/agent-tryon.mjs`](../../scripts/agent-tryon.mjs)

## Readiness checks

Before driving paid traffic, verify the platform is live and compliant. For current supply/demand figures, run the audits in the [Phase 1 audit](../ops/phase1-audit.md) — do not rely on dated snapshots.

### Dashboard compliance flags

```bash
curl -s https://api.onpoint.famile.xyz/api/agent/dashboard | jq .compliance
```

All four flags must be `true` before driving paid agent traffic:

- `erc8004Registered` — agent registered on ERC-8004 identity registry
- `selfAgentIdRegistered` — Self Protocol agent ID verified
- `walletOnchain` — agent wallet address resolves on Celo
- `verifiableReceipts` — at least one receipt with an on-chain tx hash

## Referral tracking

Agents earn 2.5% commission on referred purchases — pass an `X-Referral-Code` header or `?referral=` query param on orders, or share `https://onpoint.fly.dev/r/[referralCode]` links. View earnings at `GET /api/agent/dashboard` or the UI at `https://onpoint.fly.dev/agent`.

Full details: [referral-tracking.md](./referral-tracking.md)

## Phase 1 metrics

Third-party (non–platform-wallet) try-ons and orders are tagged `caller=third_party` in API logs and Prometheus action counters (`agent_try_on_third_party`, `agent_order_third_party`). Own-agent loops do not count as demand proof.

## Ops: supply readiness

```bash
# Fast directory-level gate: wallet + live, trusted physical listings
curl -s 'https://api.onpoint.famile.xyz/api/curator/directory?agentPurchasable=1' | jq '.meta'
node scripts/agent-commerce-ready.mjs

# Listing-level pilot baseline: completeness, freshness, field coverage, blockers
node scripts/trusted-offer-audit.mjs
```

The listing-level audit uses only the public directory/storefront contracts, includes inactive curators to expose fixable supply gaps, excludes digital try-on-only listings from physical readiness, and never writes to the database. Treat its output as an operational baseline; it is not evidence of third-party traction.

For the merchant-by-merchant gate and weekly operating cadence, use the [Merchant Onboarding Scorecard](../ops/merchant-onboarding-scorecard.md) and [Weekly Pilot Report](../ops/weekly-pilot-report.md).

Admin UI (`/admin/curators`) shows **Ready / Wallet only / No wallet**.  
Per-curator wallet editor: `/admin/curators/[slug]` → Commerce → **Generate custodial** or Save wallet.

**Bootstrap batch (after API deploy):**

```bash
SERVICE_API_KEY=... node scripts/bootstrap-curator-payout-wallets.mjs
```

Full curator wallet ops (custodial, Magic, MiniPay, migrate): [curator-payout-wallets.md](../ops/curator-payout-wallets.md)

**API deploy note:** `physicalListingCount` / `agentPurchasable` require the latest `apps/api` on Hetzner. Until then the ops script lists `stockedNoWallet` from live − digital counts.

## Agent Looks

Looks are the distribution layer. An agent composes OnPoint listings into a shareable "look" — a styled outfit with a hero piece, supporting items, tags, and an optional cover image. Each look has a public page at `/look/:slug` that drives try-ons and purchases back to the curator's storefront.

### The viral loop

```
Agent creates a look from OnPoint inventory
  → Shares /look/:slug link
  → Visitor tries on the hero piece (face superimposed via VTON)
  → Gets an Instagram-ready 1080x1350 collage card:
      - Hero: the try-on render (face + outfit)
      - Strip: thumbnails of other items in the look
      - Footer: "Styled by 0xABCD..." + OnPoint branding + look URL
  → Posts it to IG stories
  → Followers discover the look
  → Some try on / buy (carrying the agent's referral code)
  → Agent earns 2.5% commission, auto-settled every 30 min
  → Curator earns 95% on the sale
```

The agent's edge is taste and distribution, not markup. They don't charge their human more — they create cultural value and capture the distribution upside through referral commissions.

### API

```bash
# Create a look
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

# List looks (public)
GET /api/looks
GET /api/looks?curator=zara
GET /api/looks?tag=streetwear
GET /api/looks?agent=0x...

# Get a look with resolved listings
GET /api/looks/:slug

# Try-on via a look (generates share card)
POST /api/agent/try-on
Body: { ..., "lookSlug": "weekend-street-fit-n19o" }
Response includes: shareCard.imageUrl (1080x1350 WebP collage)
```

### Attribution

- Try-ons via a look increment `tryOnCount` on the look
- Purchases from a look page carry the agent's referral code (2.5% commission)
- Referral commissions are auto-settled by the payout worker (`POST /api/cron/referral-payout`, runs every 30 min)
- The look page shows analytics: try-ons, purchases, shares

### Human-agent linking

Look creation is now open to anyone with a wallet — including human curators styling their own inventory. A curator who creates a look from their own catalog earns both the sale (95%) and the referral commission (2.5%).

**Two auth paths:**

1. **Agent**: `x-agent-address` header (wallet address)
2. **Curator**: `x-curator-slug` + `x-curator-whatsapp` headers (WhatsApp verification) — the curator's wallet address (from `linkedAgentAddress`, `commerce.walletAddress`, or custodial wallet) is used as the creator address

**Linking an agent to a curator:**

A curator can link an agent wallet address to their storefront. This is a soft link — not authorization. The agent still uses their own wallet. The link is for attribution and discovery: looks created by that agent appear on the curator's storefront page.

```bash
# Link an agent to a curator's storefront
POST /api/looks/curator/{slug}/link-agent
Body: { "whatsapp": "+254712345678", "agentAddress": "0x..." }
```

A curator can also set this to their own wallet to create looks themselves.

**UI:**

- Curator storefront page (`/s/[slug]`) shows a "Link an Agent" panel (owner-only) and a "Create a Styled Look" form (owner-only, appears when the curator has 2+ live physical listings)
- Storefront page shows "Styled Looks" section with looks featuring this curator's items
- `/looks` directory page shows all live looks

**The bridge:**
Curators bring taste and inventory. Agents bring distribution. Looks are the shared surface. A curator can style their own inventory, or they can let an agent do it — either way, the look drives try-ons and purchases back to the curator's storefront, and the creator earns referral commission.
