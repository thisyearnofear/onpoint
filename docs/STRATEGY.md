# OnPoint Strategic Direction

**Last Updated**: 2026-07-07

---

## Executive Summary

OnPoint is a **multi-sided AI fashion platform** serving three distinct customer segments:

1. **Curators** (PRIMARY) — Small-business fashion sellers who need storefronts, payments, and inventory tools
2. **Consumers** — Style seekers who need AR try-on, AI coaching, and shopping discovery
3. **AI Agents** — Autonomous shopping agents owned by power users seeking agentic commerce infrastructure

**Current Status**: Production beta. 9 human curator archetypes seeded, 1 AI digital curator (Nia Digital) live with 8 digital garments. Agent commerce live on Celo with x402 try-on payments.

**Strategic Pivot**: Curator-first growth via diagnosis-then-enhancement, NOT rebuild.

---

## What's Built

### Curator Surfaces (Production-Ready)
- **`/curator`** — Curator landing page with archetypes, testimonials, benefits, how-it-works
- **`/curator/onboard`** — Self-serve onboarding form with comprehensive vertical taxonomy
- **`/s/[slug]`** — Branded curator storefronts with try-on, polaroid sharing, WhatsApp/M-Pesa checkout
- **`/admin/curators/[slug]`** — Per-curator management (listings, payments, notifications, reply templates)
- **`/curators`** — Public curator directory with AI/human badges and digital listing counts

### Digital Curators (ADR 0011 — Live)
- **Nia Digital** (`/s/nia`) — AI curator with 8 AI-generated digital garments (Venice SD35)
- Digital listings: `inventoryType: "digital"`, no sizes/stock, try-on only
- **Digital→Physical funnel**: try-on returns `similarPhysicalItems` from human curators matched by tags
- `GET /api/listings/:id/similar` — public endpoint for similar physical items
- Storefront UI renders digital listings with violet badge, tags, try-on CTA (no commerce panel)
- TryOnResult renders "Shop the real thing" section linking to human curator storefronts

### Agent Commerce (ADR 0010, 0011 — Live)
- **ERC-8004 registered** agent wallet on Celo
- **x402 try-on payments** — agents pay $0.25 cUSD per try-on via 402 challenge flow
- **Agent storefront checkout** — `POST /api/curator/:slug/order` with 0xSplits payout routing
- **`agent.json`** manifest at `/.well-known/agent.json` advertises capabilities to external agents
- Digital listing orders return 409 with redirect to try-on endpoint
- Agent dashboard, heartbeat, mint, wallet endpoints at `/api/agent/*`

### Consumer Surfaces
- **`/`** — Homepage with persona selector, body type, occasion, vibe pickers
- **`/shop`** — Product grid with cart, fly-to-cart animation, checkout modal
- **`/style`** — Virtual try-on / live stylist
- **`/lab`** — Agent wallet dashboard, spending controls, missions

### Infrastructure
- Vercel (web) + Hetzner VPS (API, agent-server, worker, bridge, signer)
- Neon Postgres (Drizzle ORM), Redis (sessions/rate limiting)
- Multi-provider AI: Venice → 0G → Gemini → OpenAI fallback chain
- M-Pesa STK push, WhatsApp Business API, cUSD on Celo
- PM2 process management, Prometheus/Grafana monitoring (see `docs/MONITORING.md`)

---

## Phased Strategic Focus

### Phase 1: Curator Activation (Q3 2026 — CURRENT)

**Goal**: Make OnPoint the obvious choice for WhatsApp-first fashion sellers in Africa.

**Approach**: Diagnose blockers via curator interviews → enhance existing surfaces → measure activation.

**Key Principle**: ENHANCEMENT FIRST. We have `/curator`, `/curator/onboard`, `/s/[slug]`, `/admin/curators/[slug]`. We do NOT need to rebuild. We need to surgically improve based on real curator feedback.

**Digital curators as a discovery channel**: Nia Digital's AI-generated designs attract agents and consumers. The digital→physical funnel routes them to human curators with matching physical inventory. This is a zero-cost acquisition channel for human curators.

**Success Metrics** (90 days):
- 3 curators ready to onboard → **10 active curators**
- Curator activation rate (onboard → first sale) **> 40%**
- Weekly curator retention **> 60%**
- Curator NPS **> 50**

**What We Will NOT Do** (Anti-Pattern Guardrails):
- Build new homepage components without checking existing ones
- Duplicate functionality that lives in `/curator`
- Rebuild admin dashboard without watching curators use it first
- Add new features before understanding which existing ones underperform

---

### Phase 2: Consumer Reliability (Q4 2026)

**Prerequisite**: 10+ active curators with >40% activation rate

**Goal**: Make consumer AR styling experience fast and reliable.

**Focus Areas**:
- Move AI SDKs to backend only (cut frontend bundle ~40%)
- Centralized AI provider fallback with shared circuit breaker (Redis state)
- Error boundaries, loading states, E2E tests
- Progressive disclosure on `/` (reduce decision paralysis)
- Consolidate to ONE styling solution (Tailwind)

**Success Metrics**:
- AI response latency < 3s P95
- Camera session completion rate > 70%
- Try-on → purchase conversion > 15%
- Mobile bounce rate < 40%

---

### Phase 3: AI Agent Infrastructure (Q1 2027)

**Prerequisite**: 1,000+ weekly active consumers, 25+ curators

**Goal**: Enable AI agents to shop autonomously on behalf of their owners.

**Why This Is Last**: Agents are amazing customers FOR curators IF curators have reliable inventory, payment infrastructure, and checkout flows. Without that, agents fail purchases and erode trust.

**Focus Areas**:
- Agent-to-curator API for bulk inventory queries
- Webhook notifications for stock availability
- Agent reputation system (curator allowlists, fraud detection)
- Multi-agent collaboration (stylist + shopper + finance agent)
- Public agent SDK / docs

**Success Metrics**:
- 50+ funded agent wallets
- Agent purchase success rate > 92%
- Autonomous purchases (no approval) > 60% of agent volume
- Agent-driven curator revenue > 20% of total

---

### Phase 4: Multi-Role Homepage (Q2 2027)

**Prerequisite**: All three segments have proven traction

**Goal**: Serve all three personas from a unified homepage with role-based views.

**Design Pattern**: "Choose Your Adventure" with Smart Defaults
- Smart role detection (wallet connected = agent, curator slug = curator, default consumer)
- Persistent role toggle (top-right, URL param + localStorage)
- Each view = standalone landing page quality

---

## Completed Work (Historical Reference)

| Phase | Status | ADR |
|-------|--------|-----|
| Phase 11: Curator Primitive & Storefronts | ✅ Complete | [0002](./adr/0002-curator-primitive.md) |
| Phase 12: Bright Data Retail Intelligence | ✅ Complete | [0004](./adr/0004-brightdata-web-intelligence.md) |
| ERC-8004 Registration & Digital Curators | ✅ Complete | [0011](./adr/0011-erc8004-registration-and-digital-curators.md) |
| Agent Storefront Checkout | ✅ Complete | [0010](./adr/0010-agent-storefront-checkout.md) |
| Agent Spending Controls | ⏸️ Paused | [0005](./adr/0005-agent-spending-controls.md) |
| Auth0 Token Vault | ⏸️ Paused | — |
| Content & Affiliate Monetization | ⏸️ Paused | — |
| GoodDollar G$ Integration | 🧪 In progress | [0009](./adr/0009-gooddollar-g-integration.md) |

---

## What We Will NOT Build (Anti-Bloat Guardrails)

### Killed Entirely
- Calendar integration (no curator or consumer demand)
- Design studio / collage (low engagement)

### Moved to `/lab` (Power Users Only)
- NFT minting for style moments
- Advanced agent autonomy features
- Agent missions panel (simplify to basic wallet + spending controls)

### Deferred (Post-Phase 3)
- Multi-chain support (Celo only for now)
- Custom persona creation (train on your style)
- Creator marketplace (stylist profiles)
- Mobile app (PWA is sufficient for MVP)
- White-label storefronts

---

## Decision Framework

When evaluating new features or pivots, ask:

1. **Does this serve our current phase's primary customer?**
   - Phase 1: If it doesn't help curators sell more, defer it.

2. **Does this enhance an existing surface or duplicate one?**
   - ENHANCEMENT FIRST: Improve existing surfaces; don't rebuild.

3. **Can this be killed or simplified?**
   - Every line of code is a liability.

4. **What's the opportunity cost?**
   - Building X means not building Y.

5. **How will we measure success?**
   - No metric = no build.

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Page load time | < 2s | ✅ |
| AI response latency | < 500ms | ✅ |
| Hero → Try-On | > 40% | 📊 |
| Curator: share → visit | > 20% | ✅ |
| Curator: try-on → purchase | > 15% | 📊 |
| Cross-Curator purchases | ≥ 1/week | 📊 |
| Onboarded Curators | ≥ 10 in 90 days | 📊 |
| Digital try-on → physical visit | > 20% | 📊 New |
| Agent wallet checkout | > 15% | 📊 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| AI provider downtime | Multi-provider fallback (Venice → 0G → Gemini → OpenAI) |
| Redis unavailable | In-memory cache with fire-and-forget persistence |
| Smart contract bugs | OpenZeppelin libraries, multi-sig, emergency pause |
| IPFS reliability | Lighthouse pinning with CDN caching |
| Agent wallet depletion | Per-user escrow, spend limits, auto-funding |
| Fraud & abuse | Dead Man's Switch, anomaly detection, freezing |

---

**Document Owner**: Product Lead
**Last Reviewed**: 2026-07-07
**Next Review**: 2026-07-21
