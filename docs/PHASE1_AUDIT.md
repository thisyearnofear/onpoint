# Phase 1 Audit — Supply Graph Readiness

**Date:** 2026-07-10  
**North star:** [STRATEGY.md](./STRATEGY.md)

Audit of surfaces vs densify supply / improve fit / improve settlement for human or agent clients. Enhancement first; delete don’t deprecate.

---

## Keep & enhance (Phase 1 critical)

| Surface | Why |
|---------|-----|
| `/s/[slug]` + storefront API | Canonical catalog (human + agent) |
| Try-on (web + `/api/agent/try-on`) | Fit rail |
| `/curator`, `/curator/onboard`, WhatsApp ingest | Supply acquisition |
| `/curators` | Human demand entry to live inventory |
| `/admin/curators/*` | Ops until chat-ops covers more |
| `agent.json`, directory, x402 order | Agent demand path |
| Digital→physical (`/s/nia`, similar items) | Discovery → physical SKUs |

## Align (copy/CTA only — no rebuild)

| Surface | Action |
|---------|--------|
| `/` | Hero + CTAs → dual clients; Lab not primary; demote wallet chrome |
| `/about` | Done — mission/pillars/CTAs aligned |
| `/lab` | Default = try-on/shop useful paths; agent wallet chrome secondary |
| `/pricing` | Label shopper vs supply clearly (follow-up) |
| Brand strings | Prefer `OnPoint` via `apps/web/lib/brand.ts` |

## Consolidate / redirect (confirm analytics, then delete)

| Surface | Rationale |
|---------|-----------|
| `/style`, `/collage` | Redirect → `/lab?tab=try-on` (pages deleted) |
| `/social` | Soft redirect → `/curators` (page kept for now) |
| Homepage persona carousel in hero | Decision paralysis; move below fold or drop from first viewport |
| Homepage `EnhancedConnectButton` | Wallet before value — hide on marketing `/` |

## Do not build

- Phase 4 multi-role homepage
- New try-on or storefront stack
- Lab-as-hero marketing
- Deprecate-in-place without deletion after audit window

## Metrics instrumentation (Phase 1)

| Metric | Source |
|--------|--------|
| Third-party agent try-ons | `agent_tryon` actions tagged `caller=third_party\|own` + logs |
| Third-party agent orders | `agent_order` same tagging on storefront order confirm |
| Human try-on → purchase | Existing curator funnel analytics |
| Agent-commerce-enabled curators | Ops query: wallet + live physical SKUs |

---

**Owner:** Product  
**Next:** Homepage reshape (WS1) · supply density (WS2) · agent demand (WS4) in parallel
