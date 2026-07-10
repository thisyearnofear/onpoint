# Phase 1 Audit — Supply Graph Readiness

**Date:** 2026-07-10 (updated same day after WS0–5)  
**North star:** [STRATEGY.md](./STRATEGY.md)

Enhancement first; delete don’t deprecate.

---

## Shipped this cycle

| Workstream | Status |
|------------|--------|
| WS0 audit + kill list | ✅ This file |
| WS1 brand + homepage dual CTAs | ✅ `lib/brand.ts`, `/`, `/about` |
| WS2 supply truth | ✅ `agentPurchasable`, physical counts, admin Agent column, onboard wallet CTA |
| WS4 agent DX | ✅ [guides/agent-commerce.md](./guides/agent-commerce.md), `agent.json` docs URL |
| WS5 consolidate | ✅ `/style` + `/collage` deleted (redirect → Lab); `/social` deleted (redirect → `/curators`) |
| Admin wallet edit | ✅ `/admin/curators/[slug]` WalletEditor + `PATCH .../commerce` |
| Third-party agent metrics | ✅ `apps/api/lib/agent-demand.js` |

---

## Keep & enhance (Phase 1 critical)

| Surface | Why |
|---------|-----|
| `/s/[slug]` + storefront API | Canonical catalog (human + agent) |
| Try-on (web + `/api/agent/try-on`) | Fit rail |
| `/curator`, `/curator/onboard`, WhatsApp ingest | Supply acquisition |
| `/curators` | Human demand entry |
| `/admin/curators/*` | Ops — wallet + agent-ready badge |
| `agent.json`, directory `?agentPurchasable=1` | Agent demand path |
| Digital→physical (`/s/nia`) | Discovery → physical SKUs |

## Align (remaining)

| Surface | Action |
|---------|--------|
| `/lab` | Default try-on/shop; keep agent chrome secondary |
| `/pricing` | Label shopper vs supply clearly |
| Brand sweep | Legal/guides/share cards still say BeOnPoint in places — prefer `PRODUCT_NAME` |

## Killed / redirected

| Surface | Disposition |
|---------|-------------|
| `/style`, `/collage` | Deleted; permanent redirect → `/lab?tab=try-on` |
| `/social` | Deleted; permanent redirect → `/curators` |
| Homepage persona carousel in hero | Removed |
| Homepage wallet connect | Removed from marketing `/` |

---

## Metrics

| Metric | How to read |
|--------|-------------|
| Agent-purchasable curators | `node scripts/agent-commerce-ready.mjs` or `GET /api/curator/directory` → `meta.agentPurchasableCount` (**target ≥ 5**) |
| Third-party try-ons / orders | Logs + Prometheus `agent_try_on_third_party` / `agent_order_third_party` |
| Human try-on → purchase | Curator funnel analytics |

### Prod snapshot (2026-07-10, pre–API deploy of new fields)

- 13 curators in directory; **0** with `agentCommerceEnabled` (no payout wallets set)
- Human curators with live physical stock (wallet gap only): **wanja (20), zara, mo, juma, grace, fatima, amara (5 each)** → **7** would become agent-purchasable once wallets are set **and** Hetzner API is deployed with the new directory fields
- Digital: **nia** (8 digital, try-on only)

**Ops playbook to hit ≥5:** For each of wanja/zara/mo/juma/grace (or any five), set Celo/MiniPay wallet in `/admin/curators/[slug]` → optional Setup 0xSplit → redeploy API if `physicalListingCount` / `agentPurchasable` missing on directory → re-run `agent-commerce-ready.mjs`.

---

**Owner:** Product  
**Next:** Deploy API to Hetzner · set ≥5 curator wallets · chase third-party agent calls
