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

## Pricing

| Action | Cost | Split |
|--------|------|-------|
| Browse directory + storefronts | Free | — |
| Digital try-on (Nia) | $0.03 cUSD | 80% curator / 20% platform |
| Physical try-on (human curator) | $0.05 cUSD | 95% curator / 5% platform |
| Physical order | Listing price (KES -> cUSD) | 95% curator / 5% platform |
| Referral commission | 2.5% of order value | Paid to referring agent |
| NFT mint | $0.10 cUSD | 85% creator / 15% platform |

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
| Supply readiness check | [scripts/agent-commerce-ready.mjs](./scripts/agent-commerce-ready.mjs) |
