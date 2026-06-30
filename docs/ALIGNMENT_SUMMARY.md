# OnPoint Strategic Alignment Summary

> **⚠️ SUPERSEDED — see [docs/STRATEGY.md](./STRATEGY.md)**
>
> This document (2026-06-30) described a *planned rebuild* of the homepage as
> 100% curator-focused, with the consumer experience moved to `/shop`. That
> rebuild was attempted, found to duplicate the existing `/curator` surface, and
> reverted. The current strategy is **diagnose-then-enhance**, not rebuild.
>
> Kept for historical context only. Do not act on the rebuild plan below.

**Date**: 2026-06-30  
**Status**: ⚠️ Superseded by docs/STRATEGY.md (2026-06-30)

---

## What We Did Today

### 1. Comprehensive Product Review
Conducted deep analysis of OnPoint covering:
- UI/UX design and user flows
- System architecture and infrastructure
- Performance and reliability
- Security and monitoring gaps
- Feature bloat and focus issues

**Key Finding**: Strong technical foundation but **identity crisis** — trying to serve curators, consumers, and AI agents simultaneously without clear prioritization.

---

### 2. Strategic Decision: Phased Focus

Agreed on **curator-first growth strategy** with clear phases:

**Phase 1: Curator Domination** (Q3 2026) — CURRENT
- Target: WhatsApp-first fashion sellers in Africa
- Goal: 10 active curators, 40% activation rate
- Homepage: 100% curator-focused
- Consumer experience: Moved to `/shop`
- Agent controls: Moved to `/lab`

**Phase 2: Consumer Reliability** (Q4 2026)
- Prerequisite: 10+ curators with >40% activation
- Goal: Fast, reliable AR styling experience
- Focus: Performance, error handling, mobile optimization

**Phase 3: AI Agent Infrastructure** (Q1 2027)
- Prerequisite: 1,000+ weekly active consumers, 25+ curators
- Goal: Enable autonomous agent shopping
- Why last: Agents are great customers FOR curators, but need reliable curator infrastructure first

**Phase 4: Multi-Role Homepage** (Q2 2027)
- Prerequisite: All three segments have proven traction
- Goal: Serve all personas from unified homepage with role toggle
- Design: Smart defaults, URL-based routing, persistent preferences

---

### 3. Documentation Created

#### `docs/STRATEGY.md` (Comprehensive Strategy)
- Executive summary of the identity crisis
- Phased roadmap with clear exit criteria
- Success metrics per phase
- Architecture simplification plan
- Monitoring and observability requirements
- Risk mitigation
- Decision framework for future features

#### `docs/PHASE_1_IMPLEMENTATION.md` (Tactical Plan)
- Week-by-week breakdown of curator-focused build
- Week 1: Homepage redesign (curator-first)
- Week 2: Mobile-first curator dashboard
- Week 3: Order management & CRM
- Week 4: Self-serve product upload & automation
- File-specific changes needed
- Testing strategy
- Deployment plan

#### `docs/WEEK_1_CHECKLIST.md` (Immediate Action Plan)
- Day-by-day checklist for Week 1
- Component code examples
- Testing checklist
- User testing protocol
- Deployment steps
- Success criteria

---

## Current Situation

### Three Curators Ready
You have **3 curators ready to onboard** but the current homepage confuses them with persona selectors and consumer-focused content.

### Consumer Experience
**Semi-useful but unreliable and slow**:
- AI latency issues (Vercel → Hetzner proxy adds hops)
- Large bundle size (6 AI provider SDKs in frontend)
- Inconsistent error handling
- Mobile camera flow has gaps

### AI Agent Opportunity
Agents would be **amazing customers for curators** IF:
- ✅ Curators have reliable inventory
- ✅ Checkout flow is fast
- ✅ Agent API is stable
- ✅ Catalog is comprehensive

Building agent infrastructure BEFORE curator infrastructure = failed agent purchases = eroded trust.

---

## What Gets Built (Phase 1 — Next 4 Weeks)

### Week 1: Homepage Redesign
- **New**: CuratorHero, HowItWorks, CuratorTestimonials, PricingSimple, FAQ, CTASection
- **Moved**: PersonaCarousel, StylePreferences → `/shop`
- **Removed**: Design studio, complex onboarding, agent wallet teaser
- **Navigation**: "Start Selling" (primary), "Shop Styles" (secondary), "AI Agent" (footer)

### Week 2: Mobile Dashboard
- **New**: MobileCuratorDashboard, MobileOrderCard, QuickActions
- **Goal**: Curators manage business from phones (where they already live)
- **Features**: Tab navigation, swipe actions, pull-to-refresh, bottom sheets

### Week 3: Order Management & CRM
- **New**: Order list with filters (All, Pending, Paid, Shipped, Delivered)
- **New**: Customer insights (total orders, last order, total spent)
- **API**: `/api/curator/orders`, `/api/curator/customers`
- **Integration**: WhatsApp shipping notifications

### Week 4: Self-Serve & Automation
- **New**: Self-serve product upload from phone camera
- **New**: Broadcast modal (send messages to customer segments)
- **API**: `/api/curator/products/upload`, `/api/curator/broadcast`
- **Goal**: Curators can add products and market without admin help

---

## What Gets Killed/Deferred

### Killed Entirely
- ❌ Calendar integration (no demand)
- ❌ Design studio / collage (confusing, low engagement)
- ❌ Complex multi-persona unlock system (simplify to 2 personas max)

### Moved to `/lab` (Power Users Only)
- ⏸️ NFT minting for style moments
- ⏸️ Agent missions panel (simplify to basic wallet + spending controls)
- ⏸️ Advanced agent autonomy features

### Deferred to Post-Phase 3
- ⏸️ Multi-chain support (Celo only for now)
- ⏸️ Custom persona creation
- ⏸️ Creator marketplace
- ⏸️ Mobile app (PWA sufficient)
- ⏸️ White-label storefronts

---

## Success Criteria (Don't Move to Phase 2 Until)

**Phase 1 Exit Criteria** (must hold for 3 consecutive weeks):
- ✅ **10 active curators** (≥1 sale in last 30 days)
- ✅ **40% activation rate** (onboard → first sale within 7 days)
- ✅ **60% week-1 retention** (logs in 2+ times in first week)
- ✅ **NPS > 50** (curator survey: "Would you recommend?")

**How We Measure**:
- PostHog funnels tracking: Homepage → Onboard → First Product → First Sale
- Weekly curator cohort analysis
- NPS survey sent after 2 weeks (automated email)

---

## Architecture Improvements (Phase 2)

### Performance
- Move AI SDKs to backend only (cut frontend bundle 40%)
- Implement proper caching (CDN, Redis, browser)
- Consolidate to Tailwind only (remove Pigment CSS)
- Optimize React re-renders (audit 605 hook instances)

### Reliability
- Centralized AI provider fallback with shared circuit breaker
- Error boundaries on all major components
- E2E tests for critical flows
- Fix mobile camera scan-signals gap

### Infrastructure
**Option A: Full Serverless** (Recommended)
- Vercel Edge + Neon Postgres + Upstash Redis + Cloudflare R2
- Zero ops burden, auto-scaling, global edge
- Cost scales with usage

**Option B: Hybrid** (If agent autonomy requires it)
- Keep Hetzner for AI inference + agent operations
- Add load balancer + 2nd VPS for redundancy
- Cloudflare CDN in front

---

## Decision Framework Going Forward

Before building ANY new feature, ask:

1. **Does this serve our current phase's primary customer?**
   - Phase 1: If it doesn't help curators sell more, defer it.

2. **Can this be killed or simplified?**
   - Every line of code is a liability. Can we achieve 80% of value with 20% of effort?

3. **Does this create product complexity or reduce it?**
   - New UI surface = complexity. Removing features = simplification.

4. **What's the opportunity cost?**
   - Building X means not building Y. Is X the highest leverage thing we could do?

5. **How will we measure success?**
   - If we can't define a metric, we can't know if it worked. No metric = no build.

---

## Multi-Role Homepage (Phase 4 Strategy)

### When to Build
**NOT NOW.** Only after:
- ✅ 10+ active curators (Phase 1 exit)
- ✅ 1,000+ weekly active consumers (Phase 2 exit)
- ✅ 50+ funded agent wallets (Phase 3 exit)

### How to Build (When the Time Comes)

**Design Pattern**: "Choose Your Adventure" with Smart Defaults

```typescript
// Smart role detection
const detectedRole = 
  hasWalletConnected ? 'agent' :
  hasCuratorSlug ? 'curator' :
  'consumer'; // Default

// Persistent toggle (top-right, always visible)
<RoleToggle>
  <button>For Me</button>      {/* Consumer */}
  <button>For Business</button> {/* Curator */}
  <button>AI Agent</button>     {/* Agent */}
</RoleToggle>

// URL-based routing (shareable, SEO-friendly)
beonpoint.xyz              → Consumer (default)
beonpoint.xyz?role=curator → Curator view
beonpoint.xyz?role=agent   → Agent view
```

**Each View = Standalone Landing Page Quality**:
- Consumer: "Your AI styling coach" + live camera demo
- Curator: "Turn your WhatsApp into a storefront" + earnings proof
- Agent: "Your AI shops while you sleep" + success rate stats

**Why This Could Work**:
- Legitimate multi-sided market (like Uber: drivers vs riders)
- Enables cross-pollination (consumer discovers they can be curator)
- Modern pattern (Linear, Notion, Stripe all do this)

**Why This Could Fail**:
- Decision fatigue at front door (forcing role choice before they understand product)
- SEO confusion (what to optimize for?)
- 3x testing surface (every change needs validation across all 3 views)
- Lukewarm first impressions if role-selected page is generic

**Mitigation**:
- Default to consumer view if no role selected
- Smart detection from context (wallet connected = agent, curator slug = curator)
- Each view must be as good as a dedicated landing page
- A/B test role toggle vs dedicated landing pages

---

## Immediate Next Steps (Tomorrow)

1. **Review this summary** with team, get alignment
2. **Start Week 1** (Monday 2026-07-01):
   - Create feature branch: `feat/curator-homepage-redesign`
   - Build CuratorHero component
   - Build HowItWorks component
3. **Interview 3 curators** this week:
   - Show them the plan
   - Get their input on homepage copy
   - Watch them try to onboard (screen record)
4. **Ship by Friday** (2026-07-05):
   - New homepage live
   - Consumer experience at `/shop`
   - 3 curators approve it

---

## Long-Term Vision (6-12 Months)

Once we have:
- ✅ 25+ active curators earning consistent income
- ✅ 5,000+ weekly active consumers shopping on storefronts
- ✅ 100+ AI agents executing purchases autonomously

We become **the infrastructure for agentic commerce in fashion**:
- Curators use our storefront tools
- Consumers use our AR try-on
- Agents use our commerce API
- Everyone benefits from network effects

**But we can't get there by building everything at once.** We get there by:
1. Nailing curator experience (Q3 2026)
2. Fixing consumer reliability (Q4 2026)
3. Enabling agent autonomy (Q1 2027)
4. Unifying the experience (Q2 2027)

**Discipline beats ambition.** Ship less, but ship it better.

---

## Resources Created Today

All documents live in `/Users/udingethe/Dev/onpoint/docs/`:

1. **STRATEGY.md** — Full strategic roadmap (4 phases, exit criteria, decision framework)
2. **PHASE_1_IMPLEMENTATION.md** — Week-by-week build plan for curator focus
3. **WEEK_1_CHECKLIST.md** — Day-by-day checklist for homepage redesign
4. **KARMAGAP.md** — KarmaGAP integration docs (API routes added but integration incomplete)

Memory updated:
- **Team memory**: Product review findings, multi-role homepage strategy, KarmaGAP integration, architecture snapshot
- **Private memory**: Focus on design/architecture over testing when reviewing

---

## Key Quotes to Remember

> "OnPoint is technically impressive but strategically unfocused. You've built a Ferrari engine but haven't decided if it's a race car or a minivan."

> "The path forward: Pick your customer (curator), cut features to the bone, simplify infrastructure, mobile-first everything, monitor what matters."

> "You have all the pieces. Now you need ruthless focus to assemble them into a product users can understand in 10 seconds."

> "Discipline beats ambition. We will ship less, but ship it better."

---

**Status**: ✅ Fully aligned and ready to execute  
**Next Review**: Friday 2026-07-05 (Week 1 check-in)  
**Owner**: Product + Engineering Leads

---

*This document summarizes the strategic alignment session of 2026-06-30. For detailed implementation, see the individual docs referenced above.*
