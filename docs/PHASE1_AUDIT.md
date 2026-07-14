# Phase 1 Audit — Supply Graph Readiness

**Date:** 2026-07-11 (custodial + Magic curator wallets)  
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
| Custodial payout bootstrap | ✅ `curator-payout-wallets.js`, admin batch + `/curator/wallet` |
| Magic embedded wallets | ✅ `magic-wallet.ts` + Netlify `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` |
| Codebase hygiene ([ADR 0014](./adr/0014-demand-side-discovery-components.md)) | ✅ Dead code deleted (DesignStudio, SocialFeed, useMemoryAPI); demand-side discovery components quarantined for Phase 2 rewiring |
| Navigation unification | ✅ `OnPointHeader` responsive (desktop + mobile); homepage, `/curator`, `/lab` all use shared header/footer |
| Homepage decomposition | ✅ `app/page.tsx` 1662 → 11 lines; 8 components extracted to `components/home/` |
| Lab simplification | ✅ `design` + `community` modes removed from `TacticalDashboard`; agent chrome moved to "More" sheet |
| API type safety | ✅ `jsconfig.json` + JSDoc annotations on `agent-checkout.js`, `curator-storefront.js` |
| CI lint step | ✅ Lint step added to `.github/workflows/ci.yml` |

---

## Keep & enhance (Phase 1 critical)

| Surface | Why |
|---------|-----|
| `/s/[slug]` + storefront API | Canonical catalog (human + agent) |
| Try-on (web + `/api/agent/try-on`) | Fit rail |
| `/curator`, `/curator/onboard`, `/curator/wallet`, WhatsApp ingest | Supply acquisition + payout wallets |
| `/curators` | Human demand entry |
| `/admin/curators/*` | Ops — wallet + agent-ready badge |
| `agent.json`, directory `?agentPurchasable=1` | Agent demand path |
| Digital→physical (`/s/nia`) | Discovery → physical SKUs |

## Align (remaining)

| Surface | Action |
|---------|--------|
| `/lab` | ✅ Default try-on/shop; agent chrome in "More" sheet (ADR 0014) |
| `/pricing` | Label shopper vs supply clearly |
| Brand sweep | Legal/guides/share cards still say BeOnPoint in places — prefer `PRODUCT_NAME` |
| Pricing messaging | ✅ "Zero platform fees" → "No subscription. No listing fees." (ADR 0013 reconciliation) |
| Hardcoded API URLs | ✅ `/developers`, `/pricing`, funnel route use `getApiBase()` |

## Killed / redirected

| Surface | Disposition |
|---------|-------------|
| `/style`, `/collage` | Deleted; permanent redirect → `/lab?tab=try-on` |
| `/social` | Deleted; permanent redirect → `/curators` |
| Homepage persona carousel in hero | Removed |
| Homepage wallet connect | Removed from marketing `/` |
| `DesignStudio.tsx`, `DesignPanel.tsx` | Deleted (collage/design studio, low engagement); `generateDesign` capability retained in AI providers |
| `SocialFeed.tsx`, `useMemoryAPI.ts` | Deleted (Farcaster-coupled feed); `SocialActivity` type retained in `shared-types` |
| `/api/social/feed`, `/api/social/activity` | Deleted (orphaned after SocialFeed removal) |

---

## Metrics

| Metric | How to read |
|--------|-------------|
| Agent-purchasable curators | `node scripts/agent-commerce-ready.mjs` or `GET /api/curator/directory` → `meta.agentPurchasableCount` (**target ≥ 5**) |
| Third-party try-ons / orders | Logs + Prometheus `agent_try_on_third_party` / `agent_order_third_party` |
| Human try-on → purchase | Curator funnel analytics |

### Prod snapshot (2026-07-11)

**Prior (2026-07-10):** API `20260710-140822` — 13 curators, **0** agent-purchasable; **7** stocked humans awaiting wallets (wanja, zara, mo, juma, grace, fatima, amara).

**Now:**

- Netlify: `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` set — redeploy web for Magic CTA on `/curator/onboard`
- Hetzner: `MAGIC_SECRET_KEY` on API `.env`
- **Pending after API deploy:** custodial batch → expect ≥5 `agentPurchasable`

**Deployed 2026-07-11:** API `20260711-105003` · custodial batch provisioned **7** agent-purchasable curators (wanja, zara, mo, juma, grace, fatima, amara). Verify: `node scripts/agent-commerce-ready.mjs` → `ready: true`.

**Ops playbook to hit ≥5:**

1. Deploy API (custodial routes + `CURATOR_PAYOUT_KEYS_PATH` on Hetzner, chmod 600)
2. `SERVICE_API_KEY=… node scripts/bootstrap-curator-payout-wallets.mjs` — or admin **Generate custodial** per slug
3. `node scripts/agent-commerce-ready.mjs` until `ready: true`
4. Curators self-serve: `/curator/onboard` or `/curator/wallet` — Magic, MiniPay, or custodial
5. After curator-owned wallet: admin **Setup 0xSplit** (skip while `platform_custodial`)

Guide: [curator-payout-wallets.md](./guides/curator-payout-wallets.md)

---

**Owner:** Product  
**Next:** Deploy API · run bootstrap script · verify directory · chase third-party agent calls
