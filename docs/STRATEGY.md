# OnPoint Strategic Direction

**Last Updated**: 2026-06-30

---

## Executive Summary

OnPoint is a **multi-sided AI fashion platform** serving three distinct customer segments:

1. **Curators** (PRIMARY) — Small-business fashion sellers who need storefronts, payments, and inventory tools
2. **Consumers** — Style seekers who need AR try-on, AI coaching, and shopping discovery
3. **AI Agents** — Autonomous shopping agents owned by power users seeking agentic commerce infrastructure

**Current Status**: Production beta with strong technical foundation but unclear value proposition. Three curators ready to onboard but frontend doesn't serve them well. Consumers find the product semi-useful but unreliable/slow.

**Strategic Pivot**: Curator-first growth, then expand to multi-role homepage once each segment proves traction.

---

## The Problem

### Identity Crisis
The current homepage serves everyone and no one:
- Landing page has consumer-focused persona selector
- Navigation doesn't clearly separate curator vs consumer flows
- Agent controls hidden in `/lab` with no clear entry point
- New visitors don't understand if they're shopping, selling, or configuring AI

### Feature Bloat
- 971 TypeScript files across 40+ API routes
- 6 AI providers, 4 blockchains, 80+ React components
- Virtual try-on, autonomous agents, NFT minting, GoodDollar UBI, M-Pesa, WhatsApp Business API, market intelligence, and more
- Maintenance burden is massive, new users face decision paralysis

### Performance & Reliability Issues
- Vercel → Hetzner proxy adds latency to every AI request
- 6 AI provider SDKs loaded in frontend (large bundle)
- Inconsistent design system (Tailwind + Pigment CSS)
- 605 useState/useEffect instances = excessive re-renders
- No comprehensive error handling or monitoring

---

## Strategic Direction: Phased Focus

### Phase 1: Curator Domination (Q3 2026 — CURRENT)

**Goal**: Make OnPoint the obvious choice for WhatsApp-first fashion sellers in Africa.

**Target Customers**: 
- Small-business fashion sellers currently managing inventory via WhatsApp chats
- Earn $500-$5,000/month, mostly via M-Pesa
- Pain points: Manual order tracking, payment reconciliation, inventory management

**Value Proposition**:
> "Your WhatsApp. Your Storefront. AI-Powered."
> Turn your fashion business into a branded storefront with AI assistance in 30 seconds.

**Homepage Design**: 100% curator-focused
- Hero: WhatsApp-to-storefront transformation demo
- CTA: "Start Selling in 30 Seconds" → `/curator/onboard`
- Social proof: "$12K earned by curators this month"
- Features: M-Pesa integration, WhatsApp receipts, AI product recommendations
- Consumer shopping portal at `/shop` (secondary navigation)
- Agent controls at `/lab` (footer link for power users)

**Success Metrics** (90 days):
- ✅ 3 curators ready to onboard → **10 active curators**
- ✅ Curator activation rate (onboard → first sale) **> 40%**
- ✅ Weekly curator retention **> 60%**
- ✅ Curator NPS **> 50**

**Key Features to Ship**:
1. **Mobile-first curator dashboard** — `/admin/curators/[slug]` optimized for phone
2. **Order management UI** — List orders, mark shipped/delivered, payment status
3. **Self-serve product upload** — Phone photo + description → listing (no admin intervention)
4. **Customer CRM** — Surface repeat customers, purchase history
5. **WhatsApp incoming handler** — Bot responds to "Do you have size M?" questions
6. **Marketing automation** — One-tap "broadcast new stock to past customers"

**What to Kill/Defer**:
- ❌ NFT minting for style moments → Move to `/lab` behind feature flag
- ❌ Calendar integration → Remove entirely (not curator or consumer need)
- ❌ Multiple AI persona system → Keep 2 free personas max, kill premium unlock flow
- ❌ Agent missions panel → Simplify to basic wallet + spending controls
- ❌ Design studio / collage → Archive (confusing, low engagement)

---

### Phase 2: Consumer Reliability (Q4 2026)

**Prerequisite**: 10+ active curators with >40% activation rate

**Goal**: Make the consumer AR styling experience fast and reliable.

**Value Proposition**:
> "AI styling coach that tells you what works before you buy."
> 3-second camera analysis, instant feedback, shop the recommendations.

**Focus Areas**:

**Performance Optimization**:
- Move AI SDKs to backend only (eliminate 6 provider libraries from frontend bundle)
- Implement proper caching (CDN, Redis, browser storage)
- Add bundle analyzer, cut bundle size by 40%
- Consolidate to ONE styling solution (Tailwind only, remove Pigment CSS)
- Optimize React re-renders (audit 605 hook instances)

**Reliability**:
- Centralized provider fallback with shared circuit breaker (Redis state)
- Add loading states everywhere (skeleton loaders, progress indicators, ETA)
- Error boundaries on all major components
- Fix mobile camera scan-signals gap
- Add E2E tests for critical flows (camera → analysis → recommendation → checkout)

**Simplified UX**:
- Landing page progressive disclosure (show 3 personas, "See all" expands)
- Onboarding flow instead of dumping everything on homepage
- Remove decision paralysis (body type, occasion, vibe, budget all at once = too much)

**Success Metrics** (90 days):
- ✅ AI response latency **< 3s P95**
- ✅ Camera session completion rate **> 70%**
- ✅ Try-on → purchase conversion **> 15%**
- ✅ Weekly returning users **> 30%**
- ✅ Mobile bounce rate **< 40%**

---

### Phase 3: AI Agent Infrastructure (Q1 2027)

**Prerequisite**: 1,000+ weekly active consumers, 25+ curators

**Goal**: Enable AI agents to shop autonomously on behalf of their owners.

**Target Customers**: 
- Power users who want autonomous shopping
- Crypto-native users comfortable with agent wallets
- Early adopters seeking agentic commerce

**Value Proposition**:
> "Your AI shops while you sleep."
> Set preferences, fund wallet, let AI discover and purchase on your behalf.

**Why This Is Last**:
AI agents are **amazing potential customers for curators** if:
1. ✅ Curators have reliable inventory and payment infrastructure
2. ✅ Product catalog is comprehensive and accurate
3. ✅ Checkout flow is fast and doesn't require human intervention
4. ✅ Agent API is well-documented and stable

Without (1-4), agents will fail to complete purchases and erode trust.

**Focus Areas**:
- Agent-to-curator API for bulk inventory queries
- Webhook notifications for stock availability
- Autonomous checkout without approval (below spending threshold)
- Agent reputation system (curator allowlists, fraud detection)
- Multi-agent collaboration (stylist + shopper + finance agent)

**Success Metrics** (90 days):
- ✅ 50+ funded agent wallets
- ✅ Agent purchase success rate **> 92%**
- ✅ Autonomous purchases (no approval) **> 60%** of agent volume
- ✅ Agent-driven curator revenue **> 20%** of total

---

### Phase 4: Multi-Role Homepage (Q2 2027)

**Prerequisite**: All three segments have proven traction

**Goal**: Serve all three personas from a unified homepage with role-based views.

**Design Pattern**: "Choose Your Adventure" with Smart Defaults

**Homepage Structure**:
```
1. Universal Hero (5 seconds to hook EVERYONE)
   - "AI-Powered Fashion, Your Way"
   - Compelling demo video showing all three use cases
   - Role selector (prominent but not blocking)

2. Default View (Consumer-focused if no role selected)
   - Live AR stylist demo you can try immediately
   - Social proof: "10,000+ looks analyzed this week"

3. Role-Specific Content (loads below fold based on selection)
   - Consumer view: AR try-on demo, shop now
   - Curator view: WhatsApp-to-storefront, start selling
   - Agent view: Autonomous shopping, set up agent
```

**Implementation Details**:

**Smart Role Detection**:
```typescript
const detectedRole = 
  hasWalletConnected ? 'agent' :
  hasCuratorSlug ? 'curator' :
  'consumer'; // Default
```

**Persistent Role Toggle** (top-right, always visible):
- "For Me" | "For Business" | "AI Agent"
- Saves to localStorage + URL param
- Syncs across page navigation

**URL-Based Routing** (shareable, SEO-friendly):
```
beonpoint.xyz              → Consumer (default)
beonpoint.xyz?role=curator → Curator view
beonpoint.xyz?role=agent   → Agent view

OR subdomain approach:
shop.beonpoint.xyz   → Consumer
sell.beonpoint.xyz   → Curator
agent.beonpoint.xyz  → Agent
```

**Each View = Standalone Landing Page Quality**:
- Consumer: "Your AI styling coach" + live camera demo
- Curator: "Turn your WhatsApp into a storefront" + earnings proof
- Agent: "Your AI shops while you sleep" + success rate stats

**Success Metrics**:
- ✅ Role selection engagement **> 40%** (users who interact with toggle)
- ✅ Bounce rate per role **< 35%**
- ✅ Conversion rate improves or matches dedicated landing pages
- ✅ Cross-role discovery **> 10%** (consumer becomes curator, etc.)

---

## Architecture Simplification Plan

### Current Issues
- Vercel (presentation) + Hetzner VPS (agent autonomy) split adds latency
- Three separate Node processes (API, worker, agent-server) on Hetzner
- Redis as "single source of truth" but also Neon Postgres (state drift risk)
- No redundancy, no disaster recovery plan documented

### Proposed Simplification (Post-Curator MVP)

**Option A: Full Serverless** (Recommended for scale)
```
Vercel Edge Functions (API routes)
    ↓
Neon Postgres (serverless)
    ↓
Upstash Redis (serverless)
    ↓
Cloudflare R2 (storage)
```

**Benefits**:
- Zero ops burden (no VPS management)
- Auto-scaling, global edge distribution
- Cost scales with usage
- Built-in redundancy

**Tradeoffs**:
- Lose direct server control
- Harder to run long-lived processes (worker, agent-server)
- May need separate service for autonomous agent operations

---

**Option B: Hybrid** (Keep Hetzner for agent autonomy)
```
Vercel (presentation + lightweight APIs)
    ↓
Hetzner (AI inference + agent operations) with:
    - Load balancer
    - 2nd VPS for redundancy
    - Automated backups (Redis + Postgres)
    - Monitoring/alerting (DataDog)
    ↓
Cloudflare CDN (in front of Hetzner)
```

**Benefits**:
- Keep control over agent autonomy logic
- Can run long-lived processes
- Better for GPU-intensive AI workloads

**Tradeoffs**:
- Higher ops burden
- Need to manage redundancy/failover
- Fixed costs even at low usage

---

**Recommendation**: Start with **Option A** for curator-first phase (serverless, focus on product). Evaluate **Option B** only if agent autonomy becomes core differentiator and requires dedicated infrastructure.

---

## Monitoring & Observability

### Current Gaps
- Sentry for errors, PostHog for product analytics
- No APM, no distributed tracing, no SLA alerting

### Minimum Viable Monitoring (Ship This Week)

**1. Performance Monitoring**:
```typescript
// Track P50, P95, P99 latencies per route
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.histogram('api.latency', duration, {
      route: req.path,
      method: req.method,
      status: res.statusCode,
    });
  });
  next();
});
```

**2. Business Metrics Dashboard**:
- Curator activation rate (onboard → first sale)
- Consumer conversion rate (camera → checkout)
- Agent success rate (autonomous purchase completion)
- Revenue per curator per week
- AI provider fallback rate (Venice fail → 0G → Gemini)

**3. Alerting** (PagerDuty or Slack webhooks):
- API error rate > 5% (5min window)
- Checkout success rate < 95% (15min window)
- AI latency P95 > 5s (5min window)
- Agent purchase failure rate > 15% (1hr window)

**4. Status Page** (for curators):
- Are payments working? (M-Pesa, Stripe)
- Is agent online? (heartbeat timestamp)
- AI provider health (Venice, 0G, Gemini)

---

## What We Will NOT Build

To maintain focus, we explicitly **will not** build:

### Features to Kill
- ❌ Calendar integration (no curator or consumer demand)
- ❌ NFT minting for every style session (move to `/lab` for power users only)
- ❌ Design studio / collage (confusing, low engagement)
- ❌ Multiple blockchain support (focus on Celo only for now)
- ❌ Curator-to-curator collaboration (premature, need 25+ curators first)

### Features to Defer (Post-Phase 3)
- Multi-chain agent wallets (Ethereum, Polygon, Base) → Celo only for now
- Custom persona creation (train on your style) → Too complex, low ROI
- Creator marketplace (stylist profiles) → Need 10+ stylists first
- Mobile app (React Native) → PWA is sufficient for MVP
- White-label storefronts → SaaS complexity, defer until 100+ curators

---

## Success Criteria by Phase

### Phase 1: Curator Domination (Q3 2026)
- ✅ 10 active curators (currently 3 ready)
- ✅ 40% curator activation rate (onboard → first sale)
- ✅ 60% week-1 retention
- ✅ NPS > 50

**Exit Criteria**: 3 consecutive weeks with all 4 metrics above target.

---

### Phase 2: Consumer Reliability (Q4 2026)
- ✅ AI latency < 3s P95
- ✅ 70% camera session completion
- ✅ 15% try-on → purchase conversion
- ✅ 30% weekly returning users

**Exit Criteria**: 4 consecutive weeks with all 4 metrics above target.

---

### Phase 3: AI Agent Infrastructure (Q1 2027)
- ✅ 50 funded agent wallets
- ✅ 92% agent purchase success rate
- ✅ 60% autonomous (no approval) purchase rate
- ✅ 20% agent-driven curator revenue

**Exit Criteria**: 6 consecutive weeks with all 4 metrics above target.

---

### Phase 4: Multi-Role Homepage (Q2 2027)
- ✅ All Phase 1-3 metrics remain above target
- ✅ Role selection engagement > 40%
- ✅ Bounce rate per role < 35%
- ✅ 10% cross-role discovery rate

**Exit Criteria**: 8 consecutive weeks with healthy metrics across all three segments.

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|-----------|-------|
| **Curators don't activate** | Weekly 1:1 calls, watch them use product, fix blockers within 48hrs | Product |
| **AI unreliable** | Centralized circuit breaker, fallback chain, 3s timeout → human fallback | Engineering |
| **Hetzner single point of failure** | Migrate to serverless (Vercel + Upstash + Neon) OR add 2nd VPS + load balancer | Infrastructure |
| **Feature bloat creeps back** | Every feature requires curator request + approval from product lead | Product |
| **Performance degrades** | P95 latency alerts, weekly performance review, bundle size CI checks | Engineering |
| **Cash burn on AI inference** | 0G Compute credits ($50K), monitor cost per session, kill expensive providers | Finance |

---

## Decision Framework

When evaluating new features or pivots, ask:

**1. Does this serve our current phase's primary customer?**
- Phase 1: If it doesn't help curators sell more, defer it.
- Phase 2: If it doesn't make consumers more successful, defer it.
- Phase 3: If it doesn't enable agent autonomy, defer it.

**2. Can this be killed or simplified?**
- Every line of code is a liability. Can we achieve 80% of value with 20% of effort?

**3. Does this create product complexity or reduce it?**
- New UI surface = complexity. Removing features = simplification.

**4. What's the opportunity cost?**
- Building X means not building Y. Is X the highest leverage thing we could do?

**5. How will we measure success?**
- If we can't define a metric, we can't know if it worked. No metric = no build.

---

## Communication

### Internal (Team)
- Weekly all-hands: Review metrics, celebrate wins, adjust course
- Daily standups: Blockers only (5 min max)
- Bi-weekly retros: What's working, what's not, what to change

### External (Users)
- Monthly product updates (blog post + email)
- Curator-specific newsletter (tips, best practices, success stories)
- Public roadmap (this doc) updated quarterly

---

## Conclusion

OnPoint has strong technical foundations but needs **ruthless focus** to achieve product-market fit.

**The plan**:
1. **Q3 2026**: Nail curator experience (10 active, 40% activation)
2. **Q4 2026**: Fix consumer reliability (3s latency, 70% completion)
3. **Q1 2027**: Enable agent autonomy (50 wallets, 92% success)
4. **Q2 2027**: Launch multi-role homepage (40% engagement)

Each phase builds on the previous. We don't move to Phase 2 until Phase 1 exit criteria are met.

**Discipline beats ambition.** We will ship less, but ship it better.

---

**Document Owner**: Product Lead  
**Last Reviewed**: 2026-06-30  
**Next Review**: 2026-09-30
