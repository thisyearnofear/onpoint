# OnPoint Strategic Direction

**Last Updated**: 2026-06-30

---

## Executive Summary

OnPoint is a **multi-sided AI fashion platform** serving three distinct customer segments:

1. **Curators** (PRIMARY) — Small-business fashion sellers who need storefronts, payments, and inventory tools
2. **Consumers** — Style seekers who need AR try-on, AI coaching, and shopping discovery
3. **AI Agents** — Autonomous shopping agents owned by power users seeking agentic commerce infrastructure

**Current Status**: Production beta. Strong technical foundation. 3 curators ready to onboard but giving feedback that the funnel is unclear.

**Strategic Pivot**: Curator-first growth via diagnosis-then-enhancement, NOT rebuild.

---

## What Already Exists (We Built Forward Without Auditing)

**Reality check**: Before proposing new builds, an audit of the codebase shows we have most of what we need:

### Curator Surfaces (Production-Ready)
- **`/curator`** — Full curator landing page (775 lines) with 6 archetypes (Sportswear, Streetwear, Ankara, Vintage, Tailor, Luxury), real Wanja testimonial, benefits, how-it-works, final CTA
- **`/curator/onboard`** — Self-serve onboarding form with comprehensive vertical taxonomy (21+ verticals)
- **`/s/[slug]`** — Branded curator storefronts with try-on, polaroid sharing, WhatsApp checkout
- **`/admin/curators`** — Admin dashboard
- **`/admin/curators/[slug]`** — Per-curator management (listings, payments, notifications, reply templates)

### Consumer Surfaces
- **`/`** — Current homepage with persona selector, body type, occasion, vibe pickers
- **`/shop`** — Product grid with cart, fly-to-cart animation, checkout modal
- **`/style`** — Virtual try-on / live stylist

### Agent Surfaces
- **`/lab`** — Agent wallet dashboard, spending controls, missions

### Navigation
- Desktop header already links to `/curator`, `/lab`, `/guides`, `/about`
- Mobile bottom nav exists

---

## The Real Problem (Diagnosis Required, Not Rebuild)

The 3 curators ready to onboard are confused — but **we don't know what specifically confuses them** because we haven't done curator interviews yet.

**Hypotheses to test** (in priority order):

### Hypothesis 1: Root `/` Should Lead to `/curator`
**Symptom**: Curators land on `/` and see persona selector / try-on demo. They think this is a consumer app.

**Test**: Ask the 3 curators "Where did you land first?" and "Did you understand this was for sellers?"

**Fix if confirmed**: Add curator entry point to `/` hero OR redirect new visitors with curator intent (e.g. UTM params, referral sources).

### Hypothesis 2: Onboarding Form Has Friction
**Symptom**: Curators reach `/curator/onboard` but drop off mid-form.

**Test**: Watch a curator complete the form. Note where they hesitate.

**Fix if confirmed**: Simplify form, reorder fields, add progress indicator.

### Hypothesis 3: Post-Onboarding Drop-Off
**Symptom**: Curators finish onboarding but don't add products / share storefront.

**Test**: Check existing curators' activation rates from analytics.

**Fix if confirmed**: Improve activation email, add "what's next" guidance, mobile-optimize admin dashboard.

### Hypothesis 4: Mobile Admin Dashboard
**Symptom**: Curators try to manage business from phone but admin is desktop-first.

**Test**: Watch a curator try to add a product from their phone.

**Fix if confirmed**: Mobile-first redesign of `/admin/curators/[slug]`.

---

## Phased Strategic Focus

### Phase 1: Curator Activation (Q3 2026 — CURRENT)

**Goal**: Make OnPoint the obvious choice for WhatsApp-first fashion sellers in Africa.

**Approach**: Diagnose blockers via curator interviews → enhance existing surfaces → measure activation.

**Key Principle**: ENHANCEMENT FIRST. We have `/curator`, `/curator/onboard`, `/s/[slug]`, `/admin/curators/[slug]`. We do NOT need to rebuild. We need to surgically improve based on real curator feedback.

**Success Metrics** (90 days):
- ✅ 3 curators ready to onboard → **10 active curators**
- ✅ Curator activation rate (onboard → first sale) **> 40%**
- ✅ Weekly curator retention **> 60%**
- ✅ Curator NPS **> 50**

**Activation Funnel to Instrument**:
1. Land on site → 100%
2. View `/curator` → ??% (need PostHog tracking)
3. Click "Apply" → ??%
4. Complete onboarding form → ??%
5. Add first product → ??%
6. Share storefront link → ??%
7. First sale → 40% target

**Decisions to Make Based on Curator Interviews**:
- Does root `/` need a curator entry banner?
- Should `/` redirect to `/curator` for non-authenticated visitors?
- Which onboarding step is causing drop-off?
- What's missing from admin dashboard that curators ask for?

**What We Will NOT Do** (Anti-Pattern Guardrails):
- ❌ Build new homepage components without checking existing ones
- ❌ Duplicate functionality that lives in `/curator`
- ❌ Rebuild admin dashboard without watching curators use it first
- ❌ Add new features before understanding which existing ones underperform

---

### Phase 2: Consumer Reliability (Q4 2026)

**Prerequisite**: 10+ active curators with >40% activation rate

**Goal**: Make consumer AR styling experience fast and reliable.

**Existing Surface**: `/` (current homepage), `/shop`, `/style`

**Focus Areas**:

**Performance**:
- Move AI SDKs to backend only (cut frontend bundle ~40%)
- Centralized AI provider fallback with shared circuit breaker (Redis state)
- Lazy-load AI client packages
- Consolidate to ONE styling solution (Tailwind, remove Pigment CSS)

**Reliability**:
- Add error boundaries to major components
- Add loading states (skeleton loaders, progress, ETA)
- Fix mobile camera scan-signals gap (per team memory)
- E2E tests for critical flows

**UX Simplification**:
- Progressive disclosure on `/` (show 3 personas, "See all" expands)
- Remove decision paralysis (body type + occasion + vibe + budget all at once is too much)
- Onboarding flow instead of dumping everything on homepage

**Success Metrics**:
- AI response latency < 3s P95
- Camera session completion rate > 70%
- Try-on → purchase conversion > 15%
- Mobile bounce rate < 40%

---

### Phase 3: AI Agent Infrastructure (Q1 2027)

**Prerequisite**: 1,000+ weekly active consumers, 25+ curators

**Goal**: Enable AI agents to shop autonomously on behalf of their owners.

**Existing Surface**: `/lab` (agent wallet dashboard), `packages/agent-core` (spending controls, escrow, fraud detection)

**Why This Is Last**: Agents are amazing customers FOR curators IF:
1. ✅ Curators have reliable inventory and payment infrastructure
2. ✅ Product catalog is comprehensive and accurate
3. ✅ Checkout flow is fast and doesn't require human intervention
4. ✅ Agent API is well-documented and stable

Without (1-4), agents fail purchases and erode trust.

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

**Key Implementation**:
- Smart role detection (wallet connected = agent, curator slug = curator, default consumer)
- Persistent role toggle (top-right, URL param + localStorage)
- URL-based routing (`?role=curator` or subdomains)
- Each view = standalone landing page quality

**Why Build This Last**: Only legitimate after each segment has proven demand and we have data on which routing performs best.

---

## Architecture Improvements (Run in Parallel with Phase 1)

### Current Issues
- Vercel (presentation) + Hetzner VPS (agent autonomy) split adds latency
- 6 AI provider SDKs in frontend bundle
- 605 useState/useEffect instances across 80 components (re-render risk)
- Tailwind + Pigment CSS dual systems (inconsistency)
- No comprehensive monitoring / SLA alerting

### Quick Wins (Ship This Week)
1. **API latency tracking** — P50/P95/P99 per route, Sentry alerts
2. **Bundle analyzer** — `next build --profile`, identify top 10 offenders
3. **Activation funnel** — PostHog events for curator funnel (land → onboard → product → sale)

### Medium Term (Phase 2)
1. **Move AI SDKs server-side** — Cut bundle ~40%
2. **Centralize provider fallback** — Shared circuit breaker in Redis
3. **Consolidate styling** — Pick Tailwind, drop Pigment

### Long Term (Post-Phase 3)
1. **Infrastructure decision** — Full serverless (Vercel + Upstash + Neon) vs. hybrid (keep Hetzner with redundancy)
2. **Database read replicas** for analytics
3. **APM / distributed tracing** (DataDog or New Relic)

---

## What We Will NOT Build (Anti-Bloat Guardrails)

### Killed Entirely
- ❌ Calendar integration (no curator or consumer demand)
- ❌ Design studio / collage (low engagement)

### Experimental (Not Curator-Facing)
- 🧪 KarmaGAP integration — wired at `/api/karmagap/*` (project/grant discovery + Hermes agent). Not part of the curator activation funnel; kept for future grant/ops exploration. Do NOT surface in curator or consumer UI until a phase explicitly needs it.

### Moved to `/lab` (Power Users Only)
- ⏸️ NFT minting for style moments
- ⏸️ Advanced agent autonomy features
- ⏸️ Agent missions panel (simplify to basic wallet + spending controls)

### Deferred (Post-Phase 3)
- ⏸️ Multi-chain support (Celo only for now)
- ⏸️ Custom persona creation (train on your style)
- ⏸️ Creator marketplace (stylist profiles)
- ⏸️ Mobile app (PWA is sufficient for MVP)
- ⏸️ White-label storefronts

---

## Decision Framework

When evaluating new features or pivots, ask:

1. **Does this serve our current phase's primary customer?**
   - Phase 1: If it doesn't help curators sell more, defer it.

2. **Does this enhance an existing surface or duplicate one?**
   - ENHANCEMENT FIRST: We have `/curator`, `/curator/onboard`, `/s/[slug]`, `/admin/curators/[slug]`. Improve them; don't rebuild.

3. **Can this be killed or simplified?**
   - Every line of code is a liability.

4. **What's the opportunity cost?**
   - Building X means not building Y.

5. **How will we measure success?**
   - No metric = no build.

---

## Next Immediate Steps (Week of 2026-07-01)

### Step 1: Curator Interviews (THIS WEEK)
Talk to the 3 ready curators. Watch them use the product. Specifically:
- Where did they land first?
- Did they understand this was for sellers?
- Where in the onboarding flow did they hesitate?
- What did they expect that wasn't there?
- Can they manage their store from their phone?

**Output**: Document specific blockers in `docs/curator-feedback-2026-07.md`

### Step 2: Activation Funnel Instrumentation
Add PostHog events for:
- `/curator` page view
- `/curator/onboard` started
- `/curator/onboard` completed
- First product added
- Storefront shared
- First sale

**Output**: Dashboard showing drop-off at each step

### Step 3: Targeted Fixes
Based on Step 1 findings, prioritize fixes:
- If homepage blocker → enhance root `/` or redirect to `/curator`
- If onboarding blocker → simplify `/curator/onboard` form
- If post-signup blocker → improve admin dashboard mobile UX
- If product upload blocker → enhance self-serve flow

**Output**: PR per fix, measured impact on funnel

### Step 4: Iterate
Repeat interviews after each fix. Don't move to Phase 2 until activation rate hits 40%.

---

## Success Criteria by Phase

### Phase 1 Exit Criteria (must hold 3 consecutive weeks)
- ✅ 10 active curators (≥1 sale in last 30 days)
- ✅ 40% activation rate (onboard → first sale within 7 days)
- ✅ 60% week-1 retention
- ✅ NPS > 50

### Phase 2 Exit Criteria (must hold 4 consecutive weeks)
- ✅ AI latency < 3s P95
- ✅ 70% camera session completion
- ✅ 15% try-on → purchase conversion
- ✅ 30% weekly returning users

### Phase 3 Exit Criteria (must hold 6 consecutive weeks)
- ✅ 50 funded agent wallets
- ✅ 92% agent purchase success rate
- ✅ 60% autonomous (no approval) purchase rate
- ✅ 20% agent-driven curator revenue

### Phase 4 Exit Criteria (must hold 8 consecutive weeks)
- ✅ All Phase 1-3 metrics remain above target
- ✅ Role selection engagement > 40%
- ✅ Bounce rate per role < 35%
- ✅ 10% cross-role discovery rate

---

## Conclusion

OnPoint has strong technical foundations AND most of the curator surfaces are already built. The work isn't rebuilding — it's **listening, measuring, and surgically enhancing**.

**The plan**:
1. **Talk to 3 curators** — Find specific blockers (not hypothetical)
2. **Instrument funnel** — Know where they drop off
3. **Enhance surgically** — Smallest possible change to fix each blocker
4. **Measure impact** — Did activation rate improve?
5. **Repeat** — Until 10 curators, 40% activation, then move to Phase 2

**Discipline beats ambition.** ENHANCEMENT FIRST. PREVENT BLOAT. Ship less, but ship it better.

---

**Document Owner**: Product Lead  
**Last Reviewed**: 2026-06-30  
**Next Review**: 2026-07-07 (after curator interviews)
