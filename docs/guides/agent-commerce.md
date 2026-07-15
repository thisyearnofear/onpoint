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
   Body: `{ curatorSlug, listingId, photoData }` → HTTP 402 → pay cUSD → re-POST with `paymentTxHash`.  
   Response includes fit signal / recommended size; digital try-ons may return `similarPhysicalItems`.
4. **Buy** — `POST /api/curator/{slug}/order`  
   `{ listingId, size, quantity }` → 402 → transfer exact cUSD to `payTo` (append attribution `dataSuffix` if provided) → re-POST with `paymentTxHash` (+ `quoteId`).  
   `201` includes order + Celoscan links; curator is paid on-chain.
5. **Earn referrals** — Pass `X-Referral-Code` header or `?referral=` query param to earn 2.5% commission on referred purchases.
6. **Dashboard** — `GET /api/agent/dashboard` to view wallet health, referral earnings, and activity.
7. **Earnings** — `GET /api/curator/{slug}/earnings` (public ledger).

Base API (production): `https://api.onpoint.famile.xyz`  
Manifest: [`/.well-known/agent.json`](../../apps/web/public/.well-known/agent.json)  
Reference buyer: [`scripts/agent-buyer.mjs`](../../scripts/agent-buyer.mjs)  
Reference try-on: [`scripts/agent-tryon.mjs`](../../scripts/agent-tryon.mjs)

## Launch status (2026-07-15)

| Capability | Status | Proof |
|------------|--------|-------|
| ERC-8004 registration | Live | agentId 9177, tx `0x536940e8…` on Celo |
| Self Protocol identity | Live (mock) | `selfAgentId: onpoint-agent-9177`, `status: verified` — set `SELF_API_KEY` for real registration |
| Agent wallet | Live | `0x5b33E63440e95289207120B94da78CE22F9D24fB` — CELO + cUSD funded |
| Paid try-on | Live | First real try-on: tx `0x2e1ced72…` (0.03 cUSD), receipt `receipt_mrlzmdja_579151d4` |
| Agent dashboard | Live | All compliance flags `true` at `/api/agent/dashboard` |
| Curator directory | Live | 4 agent-purchasable curators (zara, mo, juma, grace) |
| Digital curator (Nia) | Live | 8 digital listings with AI-generated garment images |
| Physical orders | Ready | Flow verified via dry-run; no real purchase yet (needs funded buyer) |
| Referral tracking | Ready | Schema + dashboard wired; no referred purchases yet |
| Curator product imagery | Pending | 20 physical listings show "photo pending" — see [curator-imagery.md](./curator-imagery.md) |

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

Agents can earn 2.5% commission by referring customers. When a purchase is made through a referral link or code, the platform records the referral and calculates commission automatically.

**How to use:**

```bash
# Option 1: Header (recommended for API clients)
POST /api/curator/wanja/order
X-Referral-Code: ref_abc123...
Content-Type: application/json

{ "listingId": "...", "size": "M", "quantity": 1 }

# Option 2: Query parameter (for shareable links)
POST /api/curator/wanja/order?referral=ref_abc123...
```

**Referral link format:**

```
https://beonpoint.netlify.app/r/[referralCode]
```

When users visit a referral link, the code is stored in sessionStorage and automatically attached to subsequent orders.

**View your earnings:**

```bash
curl https://api.onpoint.famile.xyz/api/agent/dashboard
```

Response includes:
```json
{
  "referrals": {
    "totalReferrals": 15,
    "totalCommissionCusd": "125.50",
    "pendingCommissionCusd": "45.20",
    "paidCommissionCusd": "80.30",
    "recentActivity": [
      {
        "referralCode": "ref_abc123",
        "orderAmountCusd": "19.23",
        "commissionCusd": "0.48",
        "status": "paid",
        "curatorSlug": "wanja",
        "createdAt": "2026-07-15T10:30:00Z"
      }
    ]
  }
}
```

Dashboard UI: `https://beonpoint.netlify.app/agent`

## Phase 1 metrics

Third-party (non–platform-wallet) try-ons and orders are tagged `caller=third_party` in API logs and Prometheus action counters (`agent_try_on_third_party`, `agent_order_third_party`). Own-agent loops do not count as demand proof.

## Ops: supply readiness

```bash
# Count agent-purchasable curators (wallet + live physical listings)
curl -s 'https://api.onpoint.famile.xyz/api/curator/directory?agentPurchasable=1' | jq '.meta'
node scripts/agent-commerce-ready.mjs
```

Admin UI (`/admin/curators`) shows **Ready / Wallet only / No wallet**.  
Per-curator wallet editor: `/admin/curators/[slug]` → Commerce → **Generate custodial** or Save wallet.

**Bootstrap batch (after API deploy):**

```bash
SERVICE_API_KEY=... node scripts/bootstrap-curator-payout-wallets.mjs
```

Full curator wallet ops (custodial, Magic, MiniPay, migrate): [curator-payout-wallets.md](./curator-payout-wallets.md)

**API deploy note:** `physicalListingCount` / `agentPurchasable` require the latest `apps/api` on Hetzner. Until then the ops script lists `stockedNoWallet` from live − digital counts.
