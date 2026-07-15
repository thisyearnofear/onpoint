# OnPoint Strategic Direction

**Last Updated**: 2026-07-10  
**Status**: Canonical product strategy — other docs defer here for vision, phases, and metrics.  
**Phase 1 ops:** [PHASE1_AUDIT.md](./PHASE1_AUDIT.md) · [guides/agent-commerce.md](./guides/agent-commerce.md) · `node scripts/agent-commerce-ready.mjs`

---

## North Star

> **Become the default execution layer for fashion intent that needs fit + real stock + local pay.**

Humans resolve intent on branded storefronts (`/s/[slug]`) with try-on → WhatsApp / M-Pesa.  
Machines resolve the **same inventory** via storefront APIs, x402 try-on, and agent checkout.

**Curators are how we get truthful supply** (photos, sizes, stock, settlement).  
**Agents (and human shoppers) are how demand reaches that supply.**  
Neither persona *is* the company — the scarce asset is the **fit-aware, locally payable, agent-addressable supply graph**.

```text
Intent (human or agent)
        ↓
   Fit + size signal (try-on)
        ↓
   Truthful stock (curator listings)
        ↓
   Local settlement (M-Pesa / WhatsApp | cUSD x402)
        ↓
   Curator payout + attribution
```

---

## What We Are (and Are Not)

| We are | We are not |
|--------|------------|
| Fashion **supply + fit rail** with two clients (human UI + agent API) | A horizontal “AI stylist” app competing with ChatGPT shopping |
| Beachhead: WhatsApp-era fashion inventory in emerging markets (KES, M-Pesa, chat-ops) | Only a WhatsApp seller CMS |
| Category specialist agents must call when fit + local pay matter | Only “our” shopping agent in `/lab` |
| Enhancement of Engine + Cast + dual Loop (ADR 0002 layers) | A rebuild or third product surface |

**Tagline (working):** Fit before you buy — for people and agents.

---

## Roles (not a primary-customer hierarchy)

| Role | Job in the system | Product implication |
|------|-------------------|---------------------|
| **Curators** (human / AI / digital) | Supply + taste + ops | Onboard density, stock truth, chat-ops, payout wallets. Future: create looks from own inventory, link agents for distribution |
| **Human shoppers** | Demand via storefront / try-on | No wallet/Auth0 before first try-on; WhatsApp/M-Pesa checkout |
| **External agents** | Demand via API + looks | Discoverable offers, paid try-on, checkout success, look creation (style boards with shareable collage cards), third-party usage |
| **OnPoint platform** | Match + fit + settlement + distribution | Take rate, try-on fees, attribution, referral payouts — not Lab demos |

Own-agent wallet / missions / NFT chrome in `/lab` is **infrastructure and power-user tooling**, not the hero narrative.

---

## Current Status (production beta)

- 9 human curator archetypes seeded; 1 digital curator (Nia Digital) with digital→physical funnel
- Agent commerce live on Celo: x402 try-on, storefront checkout, curator splits ([ADR 0010](./adr/0010-agent-storefront-checkout.md), [ADR 0011](./adr/0011-erc8004-registration-and-digital-curators.md))
- Human loop live: `/s/[slug]`, WhatsApp/M-Pesa, try-on, polaroids
- Product clarity: homepage dual CTAs (shop + supply); Lab demoted from primary hero; navigation unified via `OnPointHeader`
- Directory truth: `agentPurchasable` = wallet + live physical SKUs ([guides/agent-commerce.md](./guides/agent-commerce.md))
- **Revenue without human curator wallets**: digital try-on ($0.03, Nia), NFT minting ($0.10), agent markup model. Human storefront pages (`/s/[slug]`) are browsable and WhatsApp-checkout-able even without a wallet — curators can share their link before going agent-live.
- **Curator gating**: human curators are hidden from the agent directory until they self-serve and set up a payout wallet (`activatedAt` + `agentPurchasable`). `?includeInactive=1` shows all for admin/nudge purposes. Curator identity is currently trust-based (admin-seeded or self-applied via `/curator/onboard`); WhatsApp number is the primary trust signal. Production needs WhatsApp OTP / social proof verification.
- **Agent looks + share cards live**: agents compose listings into shareable style boards (`/look/:slug`); try-on via a look generates an Instagram-ready 1080x1350 collage card; referral payout worker auto-settles 2.5% commissions every 30 min
- Binding constraint: **payout wallets on stocked curators + third-party agent calls** (see [PHASE1_AUDIT.md](./PHASE1_AUDIT.md) prod snapshot)
- Codebase hygiene: dead code removed, homepage decomposed, ADR 0014 filed for demand-side discovery component rewiring

---

## What's Built (surfaces)

Detail lives in [FEATURES.md](./FEATURES.md) and ADRs. Strategy-level map:

| Surface | Role |
|---------|------|
| `/s/[slug]` + storefront API | **Canonical catalog** — human HTML + machine offers, one inventory |
| Try-on (web + `POST /api/agent/try-on`) | **Fit rail** — size/fit signal; digital→physical matching |
| `/look/[slug]` + `POST /api/looks` | **Distribution layer** — agent-composed style boards with shareable try-on collage cards. Viral loop: agent creates look → visitor tries on → gets Instagram-ready collage → shares → followers discover → try on / buy → agent earns 2.5% referral, curator earns 95% on sale |
| `/curator`, onboard, admin, WhatsApp ingest | **Supply acquisition & ops** (admin wallet editor) |
| `/.well-known/agent.json`, directory, x402 order | **Agent demand path** |
| `/`, `/lab`, `/shop` | Marketing + power surfaces — Lab is not the hero; uses `OnPointHeader` |
| `/style`, `/collage`, `/social` | **Removed** — redirects to Lab try-on or `/curators`. Demand-side discovery components (LooksFaceoff, CommunityPanel) quarantined per [ADR 0014](./adr/0014-demand-side-discovery-components.md) for Phase 2 rewiring. Agent looks (`/look/:slug`) is the successor — agent-driven distribution, not a user-facing design studio |

Infrastructure: Vercel/Netlify (presentation) + Hetzner (API, worker, signer, bridge) — [ADR 0001](./adr/0001-backend-first-autonomy.md). Monitoring: [MONITORING.md](./MONITORING.md).

---

## Phased Focus

Phases optimize the **supply graph**, not a single persona. Prerequisites are readiness gates, not “finish sellers before touching agents.”

### Phase 1: Supply Graph Readiness (Q3 2026 — CURRENT)

**Goal:** Enough fit-aware, agent-commerce-enabled inventory that a third party can try on and buy with high success — while humans keep converting on WhatsApp.

**Co-primary workstreams** (parallel, enhancement-first):

1. **Supply** — Activate curators with truthful stock, sizes, photos, and `commerce.walletAddress` where agent payouts matter; chat-ops over CMS where possible ([ADR 0002](./adr/0002-curator-primitive.md)).
2. **Fit rail** — Reliable try-on + size recommendation on storefront and agent try-on; digital→physical funnel as discovery → physical SKU.
3. **Agent demand** — Third-party (not only own-agent) try-on/order volume; offer quality; directory + `agent.json` accuracy.
4. **Product clarity** — UI/docs express the north star (homepage/CTAs/Lab demotion) without rebuilding surfaces.

**Success metrics (90 days):**

| Metric | Target | Why |
|--------|--------|-----|
| Agent-commerce-enabled curators (wallet + live physical SKUs) | ≥ 5 | Minimum graph for external agents |
| Live physical SKUs with size/stock truth | ≥ 50 | Empty catalogs kill agent trust |
| Third-party agent try-ons / week | ≥ 20 | Proves demand path beyond demos |
| Agent order success rate (paid → fulfilled intent) | ≥ 85% | Stock + payment truth |
| Curator onboard → first human or agent sale (7d) | ≥ 40% | Supply partners must earn |
| Storefront try-on → purchase (human) | ≥ 15% | Fit rail converts |
| Digital try-on → physical storefront visit | ≥ 20% | Funnel works |

**Anti-patterns:**

- New homepage frameworks or Phase-4 multi-role “Choose Your Adventure”
- Duplicating `/curator` or `/s/[slug]`
- Growing Lab/agent chrome as the public hero
- Deferring all agent work until “10 curators + 1k consumers”
- Building features that neither densify supply nor improve fit/settlement for either client

---

### Phase 2: Execution Reliability (Q4 2026)

**Prerequisite:** Phase 1 metric bar mostly met (especially stock truth + agent success rate).

**Goal:** Make try-on → pay → fulfill trustworthy at higher volume for humans and agents.

**Focus:** Backend-only AI SDKs / bundle cut; shared provider circuit breaker; error/loading/E2E; progressive disclosure on `/`; one styling system; stock webhooks / freshness; agent DX docs.

**Metrics:** AI P95 useful for try-on path; camera/session completion > 70%; agent checkout success > 92%; mobile bounce on storefronts < 40%.

---

### Phase 3: Default Fashion Rail for Agents (Q1 2027)

**Prerequisite:** Sustained third-party agent usage + denser supply (guide: 25+ curators or equivalent SKU depth).

**Goal:** Become the category endpoint agents prefer for fit-sensitive, locally settled fashion — not a generic shopper.

**Focus:** Bulk inventory query APIs; stock webhooks; curator allowlists / agent reputation; public agent SDK; protocol alignment as needed (without abandoning x402/Celo wedge); multi-agent handoff only when it serves execution.

**Metrics:** 50+ funded external agent relationships or equivalent call volume; agent-driven GMV share meaningful to curators; autonomous (policy-allowed) share of agent volume > 60% where applicable.

---

### Phase 4: Multi-Client Homepage (Q2 2027)

**Prerequisite:** Supply graph + both demand paths have proven traction.

**Goal:** One marketing front door with clear paths to supply onboarding vs try-on vs agent docs — smart defaults, not three products. Still enhancement of `/`, not a rewrite for its own sake.

---

## Completed / Paused Work

| Item | Status | ADR |
|------|--------|-----|
| Curator primitive & storefronts | ✅ | [0002](./adr/0002-curator-primitive.md) |
| Bright Data retail intelligence | ✅ | [0004](./adr/0004-brightdata-web-intelligence.md) |
| ERC-8004 & digital curators | ✅ | [0011](./adr/0011-erc8004-registration-and-digital-curators.md) |
| Agent storefront checkout + paid try-on | ✅ | [0010](./adr/0010-agent-storefront-checkout.md) |
| Agent spending controls | ⏸️ | [0005](./adr/0005-agent-spending-controls.md) |
| Auth0 Token Vault | ⏸️ | — |
| Content & affiliate monetization | ⏸️ | — |
| GoodDollar G$ | 🧪 | [0009](./adr/0009-gooddollar-g-integration.md) |
| Demand-side discovery components | 📦 Quarantined | [0014](./adr/0014-demand-side-discovery-components.md) |

---

## What We Will Not Build

**Killed:** Calendar integration; user-facing design studio / collage (low engagement — note: agent-driven looks with shareable collage cards is a different thing — it's distribution, not a design tool).

**Lab only (power users):** NFT minting; advanced own-agent autonomy UI; missions complexity — keep wallet/spend basics if needed, never homepage hero.

**Deferred:** Multi-chain beyond Celo wedge; custom persona training; creator marketplace; native mobile app (PWA enough); white-label storefronts; horizontal “build our own ChatGPT shopper” as the company.

---

## Decision Framework

1. **Does this densify truthful supply, improve fit signals, or improve settlement for human or agent clients?** If no → defer.
2. **Enhance an existing surface or duplicate one?** Enhancement first; delete don’t deprecate.
3. **Can this be killed or simplified?** Every line is a liability.
4. **Opportunity cost** against Phase 1 co-primary metrics.
5. **No metric → no build.** Prefer third-party agent usage and stock truth over vanity Lab metrics.
6. **Client clarity:** Human path must not require wallet/Auth0 before first try-on ([ADR 0002](./adr/0002-curator-primitive.md) §5). Agent path must not depend on Lab UI.

---

## Operating Metrics (dashboard)

| Metric | Target | Notes |
|--------|--------|-------|
| Page load (key surfaces) | < 2s | ✅ baseline |
| Agent-commerce-enabled SKUs | Growing | Prefer **agentPurchasable** curators (wallet + live physical) — [PHASE1_AUDIT.md](./PHASE1_AUDIT.md) |
| Third-party agent try-ons | Growing | Phase 1 demand proof (`caller=third_party`) |
| Agent order success | ≥ 85% → 92% | Phase 1 → 2 |
| Curator: share → visit | > 20% | ✅ |
| Curator: try-on → purchase | > 15% | 📊 |
| Digital try-on → physical visit | > 20% | 📊 |
| Cross-curator attributed purchases | ≥ 1/week | 📊 |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Empty graph / bad stock | Curator activation + chat-ops; block agent-sell when stock/wallet missing |
| Own-agent-only “usage” | Instrument and prioritize third-party callers; grant/reviewer bar |
| AI provider downtime | Venice → 0G → Gemini → OpenAI fallback |
| Protocol giants own checkout | Stay category + fit + local-pay specialist; expose offers cleanly |
| Seller grind vs agent narrative | Co-primary metrics; don’t starve supply for DX cosplay |
| Fraud / wallet drain | Spend limits, dead man's switch, anomaly detection ([ADR 0001](./adr/0001-backend-first-autonomy.md)) |

---

## Doc Map (consolidation)

| Doc | Owns |
|-----|------|
| **This file** | Vision, phases, metrics, kill list, decisions |
| [PHASE1_AUDIT.md](./PHASE1_AUDIT.md) | Kill list + surface audit for Supply Graph Readiness |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layers, data flow, deploy topology |
| [FEATURES.md](./FEATURES.md) | Feature behavior specs |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Setup |
| [adr/](./adr/) | Decision history — do not fork strategy in new ADRs; amend or link here |
| Root [README.md](../README.md) | Short pitch + pointers — no second roadmap |

---

**Document Owner**: Product Lead  
**Last Reviewed**: 2026-07-10  
**Next Review**: 2026-07-24
