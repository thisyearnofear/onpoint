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
   **Negotiate (optional):** two paths. Real haggling — `POST /api/curator/{slug}/negotiate` opens a session `{scope:"order"|"tryon", listingId, size, quantity, offerUsd}` → `{sessionId, round, status, reasoning}`; continue `POST .../negotiate/{sessionId}` with `{offerUsd}` or `{action:"accept"|"walk"}` until `accepted | rejected | expired`. The seller is a stateful policy (floor, margin, round fatigue, bundle context — hiring the stylist first unlocks a deeper floor); refusals are reachable. `accepted` returns an ed25519-signed `quoteToken` (payee's key over `{scope, listing, price, sessionId, expiry}`) — redeem once as `quoteToken` on `/order` or `/agent/try-on`. One-shot — `offerUsd` on the order body: below `commerce.priceFloorPct` → **HTTP 409** `OFFER_BELOW_FLOOR` counter; at/above → **402** at `min(offer, list)` with the price bound in `quoteId`. Omit both and behavior is unchanged.
   **NEAR Intents rail (optional):** when `paymentRails` includes `"near_intents"`, `quote.intents` names the verifier, token id, and amount — deposit the settlement FT to the verifier ledger (`ft_transfer_call`), sign a NEP-413 transfer intent (full-access key; the verifier's own `add_public_key` must know the pubkey first), the seller executes `execute_intents`, and the buyer re-POSTs `{nearAccountId, intentsTxHash, quoteId}`.
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

Agents earn 2.5% commission on referred agent-API purchases (storefront M-Pesa orders record the referral but do not pay a commission) — pass an `X-Referral-Code` header or `?referral=` query param on orders, or share `https://onpoint.trustfall.xyz/r/[referralCode]` links. View earnings at `GET /api/agent/dashboard` or the UI at `https://onpoint.trustfall.xyz/agent`.

Full details: [referral-tracking.md](./referral-tracking.md)

### Share attribution (optional)

If a human or agent reached you through a shared look link (`?sid=<id>`), pass that id back so the share can be followed to its outcome: `shareId` in the `POST /api/agent/try-on` body, and `X-Share-Id` (or `?sid=`) on `POST /api/curator/{slug}/order`. It never changes price or commission, and an invalid id is ignored. See [Share Attribution](../../AGENTS.md#share-attribution).

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

1. **Agent**: `Authorization: Bearer <session token>` from `POST /api/auth/challenge` → sign → `POST /api/auth/verify` (a bare `x-agent-address` header is rejected for writes)
2. **Curator**: same Bearer session + `x-curator-slug` header — the signed wallet must be the curator payout/custodial wallet or the linked agent wallet

**Linking an agent to a curator (two-sided consent):**

A curator can link an agent wallet address to their storefront. This is a soft link — not authorization. The agent still uses their own wallet. The link is for attribution and discovery: looks created by that agent appear on the curator's storefront page. Linking requires both sides to sign plus a one-time code to the WhatsApp number on file — a phone number alone is no longer a credential.

```bash
# 1. Curator (payout-wallet session) requests a code — sent to the stored WhatsApp number
POST /api/looks/curator/{slug}/link-agent/request
Headers: Authorization: Bearer <curator-session>, x-curator-slug: {slug}

# 2. Curator confirms with the code + the agent's own session token (agent consent)
POST /api/looks/curator/{slug}/link-agent/verify
Headers: Authorization: Bearer <curator-session>, x-curator-slug: {slug}
Body: { "otp": "123456", "agentAddress": "0x...", "agentToken": "<agent-session>" }
```

The legacy `POST /api/looks/curator/{slug}/link-agent` with `{ whatsapp, agentAddress }` returns `410 Gone`.

A curator can also set this to their own wallet to create looks themselves.

**UI:**

- Curator storefront page (`/s/[slug]`) shows a "Link an Agent" panel (owner-only) and a "Create a Styled Look" form (owner-only, appears when the curator has 2+ live physical listings)
- Storefront page shows "Styled Looks" section with looks featuring this curator's items
- The wardrobe's outfits tab lists live looks for readers (`/?tab=outfits&curator=[slug]`; `/looks` permanently redirects there)

**The bridge:**
Curators bring taste and inventory. Agents bring distribution. Looks are the shared surface. A curator can style their own inventory, or they can let an agent do it — either way, the look drives try-ons and purchases back to the curator's storefront, and the creator earns referral commission.
