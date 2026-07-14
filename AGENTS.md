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
| Chain | Celo mainnet (chainId 42220) |
| Payment tokens | cUSD, USDC |
| x402 facilitator | https://api.x402.celo.org (EIP-3009, gasless) |

---

## What You Can Do

1. **Browse** curators and storefronts (free, no auth)
2. **Try on** items before buying ($0.03 digital, $0.05 physical, cUSD via x402)
3. **Buy** physical items from curator storefronts (cUSD on Celo)
4. **Mint** fashion NFTs with 0xSplits royalties ($0.10)
5. **Check earnings** — public reconciled ledger per curator

---

## The Flow (5 Steps)

### Step 1: Discover Curators

```bash
GET /api/curator/directory?agentPurchasable=1
```

Returns curators with `agentPurchasable: true` (payout wallet + live physical SKUs).

Key fields per curator:
- `slug` — use this for storefront/order endpoints
- `agentPurchasable` — true = wallet + live physical listings (you can buy)
- `agentCommerceEnabled` — true = wallet configured (may have zero offers)
- `digitalTryOnEnabled` — true = has digital designs (try-on only, no purchase)
- `liveListingCount`, `physicalListingCount`, `digitalListingCount`

Without `?agentPurchasable=1`, the directory returns all curators visible to agents (includes digital curators like Nia).

### Step 2: Browse a Storefront

```bash
GET /api/curator/{slug}/storefront
```

Returns the curator profile + all live listings. Look for `agentCommerce` on each listing:

```json
{
  "agentCommerce": {
    "available": true,
    "currency": "cUSD",
    "offers": [
      { "size": "M", "stock": 4, "priceKes": 2500, "priceCusd": 19.23 }
    ]
  }
}
```

If `agentCommerce` is `null`, the curator has no wallet — you cannot buy from them via API. Digital listings have `inventoryType: "digital"` and no purchase offers (try-on only).

### Step 3: Try On (Optional but Recommended)

```bash
POST /api/agent/try-on
Content-Type: application/json

{ "curatorSlug": "nia", "listingId": "abc123", "photoData": "data:image/jpeg;base64,..." }
```

Response: **HTTP 402** (Payment Required) with payment requirements.

Pay the cUSD fee to `payTo` on Celo, then re-POST with the transaction hash:

```bash
POST /api/agent/try-on
Content-Type: application/json

{ "curatorSlug": "nia", "listingId": "abc123", "photoData": "data:image/jpeg;base64,...", "paymentTxHash": "0x..." }
```

Response: **HTTP 200** with try-on render + fit signal (recommended size, confidence).

For digital listings (Nia), the response also includes `similarPhysicalItems` — physical items from human curators that match the digital design's tags.

### Step 4: Buy a Physical Item

```bash
POST /api/curator/{slug}/order
Content-Type: application/json

{ "listingId": "abc123", "size": "M", "quantity": 1 }
```

Response: **HTTP 402** with payment requirements:

```json
{
  "quote": {
    "listingId": "abc123",
    "size": "M",
    "quantity": 1,
    "totalCusd": 19.23,
    "payTo": "0x...",
    "chainId": 42220,
    "quoteId": "..."
  },
  "accepts": [{
    "asset": "0x... (cUSD contract)",
    "maxAmountRequired": "19230000",
    "payTo": "0x...",
    "chainId": 42220,
    "dataSuffix": "0x... (attribution tag — append to tx data)"
  }]
}
```

**Two payment paths:**

**Path A — cUSD (direct transfer):**
1. Transfer the exact cUSD amount to `payTo` on Celo
2. Append the `dataSuffix` from the 402 response to the transaction data (attribution)
3. Re-POST with the transaction hash:

```bash
POST /api/curator/{slug}/order
{ "listingId": "abc123", "size": "M", "quantity": 1, "paymentTxHash": "0x...", "quoteId": "..." }
```

**Path B — USDC via x402 facilitator (gasless):**
1. Sign an EIP-3009 `transferWithAuthorization` for USDC
2. Encode the PaymentPayload as base64 JSON
3. Send it in the `X-PAYMENT` header:

```bash
POST /api/curator/{slug}/order
X-PAYMENT: <base64-encoded-payment-payload>
{ "listingId": "abc123", "size": "M", "quantity": 1, "quoteId": "..." }
```

The facilitator settles on-chain and pays gas. No `paymentTxHash` needed.

Response: **HTTP 201** with order confirmation + Celoscan links:

```json
{
  "order": {
    "id": "...",
    "item": "Arsenal 24/25 Home Kit (M)",
    "payment": { "explorerUrl": "https://celoscan.io/tx/..." },
    "payout": { "to": "0x...", "amountCusd": 18.27, "txHash": "0x...", "explorerUrl": "..." }
  }
}
```

Digital listings return **HTTP 409** (no physical product) with a redirect to the try-on endpoint.

### Step 5: Check Earnings (Public Ledger)

```bash
GET /api/curator/{slug}/earnings
```

Public reconciled ledger — try-on fees, order payouts, attribution tags.

---

## Pricing

| Action | Cost | Split |
|--------|------|-------|
| Browse directory + storefronts | Free | — |
| Digital try-on (Nia) | $0.03 cUSD | 80% curator / 20% platform |
| Physical try-on (human curator) | $0.05 cUSD | 95% curator / 5% platform |
| Physical order | Listing price (KES -> cUSD) | 95% curator / 5% platform |
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
Content-Type: application/json

{ "userAddress": "0x...", "metadataUri": "ipfs://...", "royaltyRecipient": "0x..." }
```

Requires service auth (`x-service-key` header). Mints an OnPoint NFT (ERC-721A) with 0xSplits royalty (85% creator / 15% platform).

Contract: `0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576` on Celo.

---

## Reference Implementation

The [`scripts/agent-buyer.mjs`](./scripts/agent-buyer.mjs) script demonstrates the full buy flow end-to-end:

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
| Agent commerce ADR | [docs/adr/0010-agent-storefront-checkout.md](./docs/adr/0010-agent-storefront-checkout.md) |
| Digital curators ADR | [docs/adr/0011-erc8004-registration-and-digital-curators.md](./docs/adr/0011-erc8004-registration-and-digital-curators.md) |
| Pricing ADR | [docs/adr/0013-pricing-strategy-and-agent-revenue-model.md](./docs/adr/0013-pricing-strategy-and-agent-revenue-model.md) |
| x402 facilitator ADR | [docs/adr/0012-x402-facilitator-integration.md](./docs/adr/0012-x402-facilitator-integration.md) |
| Reference buyer | [scripts/agent-buyer.mjs](./scripts/agent-buyer.mjs) |
| Supply readiness check | [scripts/agent-commerce-ready.mjs](./scripts/agent-commerce-ready.mjs) |
