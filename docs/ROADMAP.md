# Roadmap

## Current Status: Production Beta → 0G Bridge Buildathon Focus

OnPoint is a production-ready AI styling agent with:
- **Vision-powered analysis**: Real photo analysis via Venice Vision API
- **Personality-driven critique**: 6 stylist personas (3 free, 3 premium)
- **Agent wallet shopping**: Self-custodial wallet with $5-$5K spend limits
- **Live AR sessions**: Real-time Gemini Live streaming for premium users
- **Security-first**: SIWE auth, per-user escrow, fraud detection, multi-sig
- **Multi-provider AI**: Venice, Gemini, OpenAI with automatic fallback
- **Verifiable actions**: Cryptographic signing + IPFS audit trails

The core "sees → judges → shops" flow is live at https://beonpoint.netlify.app with backend API on Hetzner VPS.

**Primary Focus**: [0G Bridge Buildathon](https://apollo.0g.ai/) — 10-week program culminating at Token2049 Singapore Demo Day (October 2026).

---

## 0G Bridge Buildathon 🎯 PRIMARY FOCUS

> **Program**: 0G Bridge by AKINDO · 10 weeks · 5 Waves · $50K in 0G Credits
> **Timeline**: June 13 → August 21, 2026
> **Demo Day**: Token2049 Singapore (October 7–8, 2026)
> **Goal**: Leverage 0G Compute for African fashion model fine-tuning — unique differentiator

### Strategy: Enhancement-First Integration

**NOT migrating existing infrastructure.** Instead, adding 0G-native capabilities that:
1. Solve a genuine problem (African fashion analysis accuracy)
2. Align with roadmap ("African Differentiation" — Phase Post-MVP)
3. Create unique value (decentralized fine-tuning of fashion models)
4. Leverage 0G Credits for infrastructure cost reduction

### Wave-by-Wave Plan

#### Wave 1: Project Scoping & 0G Integration Plan (June 13–26)
**Goal**: Define architecture, get $5,000 in 0G Credits

**Deliverables**:
- [x] ADR 0006: 0G Compute Integration for African Fashion Fine-Tuning (accepted 2026-06-15)
- [x] Architecture diagram showing 0G Compute alongside existing providers
- [x] `packages/0g-compute/` — OpenAI-compatible Router client (inference)
- [x] Data pipeline design: 0G Router verified catalog (qwen3-vl-30b, minimax-m3, 0gm-1.0-35b-a3b)
- [x] Integration: 0G provider slots into `ai-client`, server-side chain, and live-session factories
- [x] Fallback chain update: Venice → 0G → Replicate → Azure (server); 0g inserted before `gemini` in each free-tier factory
- [ ] Public X post with project scope + #0GBridge #BuildOn0G

**Core Principles Alignment**:
| Principle | Application |
|---|---|
| **ENHANCEMENT FIRST** | Adding 0G Compute as a new AI provider — not replacing Venice/Gemini/OpenAI |
| **CONSOLIDATION** | One provider interface (`AIProvider`), 0G Compute is just another implementation |
| **PREVENT BLOAT** | Fine-tuning pipeline is a separate worker, not embedded in web app |
| **DRY** | Model inference uses existing `ai-client` abstraction — no new API surface |
| **CLEAN** | 0G Compute runs on Hetzner worker (ADR 0001), not on Netlify edge |
| **MODULAR** | 0G provider is swappable — can be disabled via env var |
| **PERFORMANT** | Fine-tuned model cached locally, inference only on 0G when needed |
| **ORGANIZED** | New package `packages/0g-compute/` follows existing `packages/ai-client/` pattern |

#### Wave 2: Testnet Integration & Demo (June 27 – July 10)
**Goal**: Working prototype on 0G testnet, get $7,500 in 0G Credits

**Deliverables**:
- [ ] `packages/0g-compute/` — 0G Compute SDK integration
- [ ] African fashion dataset collection script (15K+ images from open sources)
- [ ] Fine-tuning pipeline on 0G testnet (Qwen VL or similar base model)
- [ ] Demo video: Upload Ankara/Kente photo → fine-tuned model analysis → accurate style ID
- [ ] README with setup instructions + 0G integration proof
- [ ] Public X post with demo screenshot + #0GBridge #BuildOn0G

**Technical Implementation**:
```typescript
// packages/0g-compute/src/index.ts
export interface ZeroGComputeProvider {
  name: string;
  fineTune(baseModel: string, dataset: DatasetConfig): Promise<TrainingJob>;
  inference(modelId: string, input: VisionInput): Promise<CritiqueResponse>;
  status(jobId: string): Promise<TrainingStatus>;
}

// packages/ai-client/src/providers/zero-g-provider.ts
export class ZeroGProvider implements AIProvider {
  name = "0G Compute";
  
  async analyzeOutfit(input: VisionInput): Promise<CritiqueResponse> {
    // Use fine-tuned African fashion model if available
    const modelId = await this.getBestModel(input.verticals);
    return this.compute.inference(modelId, input);
  }
}
```

#### Wave 3: Mainnet Deployment (July 11–24)
**Goal**: Ship to 0G mainnet, get $15,000 in 0G Credits

**Deliverables**:
- [ ] 0G mainnet contract address for model registry
- [ ] Fine-tuned model deployed on 0G Compute mainnet
- [ ] `ai-client` fallback chain updated: Venice → 0G Compute → Gemini → OpenAI
- [ ] African fashion categories: Ankara, Kente, Adire, Bogolan, Shweshwe
- [ ] Model performance metrics: >90% accuracy on African pattern classification
- [ ] Explorer link showing on-chain activity
- [ ] Public X post with mainnet deployment proof + #0GBridge #BuildOn0G

**Integration with Existing Code**:
```typescript
// apps/web/lib/utils/provider-fallback.ts (update)
export const FALLBACK_CHAIN: AIProvider[] = [
  veniceProvider,      // Free tier, fast
  zeroGProvider,       // Fine-tuned African fashion model
  geminiProvider,      // Premium, real-time
  openaiProvider,      // Fallback
];
```

#### Wave 4: User Acquisition & Early Traction (July 25 – August 7)
**Goal**: Real users, real usage, get $10,000 in 0G Credits

**Deliverables**:
- [ ] African fashion vertical live on storefronts (/s/amara for Ankara)
- [ ] Curator onboarding flow includes "African fashion specialist" option
- [ ] Analytics tracking: African pattern detection accuracy, user engagement
- [ ] 10+ users testing African fashion analysis
- [ ] User feedback collection + iteration
- [ ] Public X post with user testimonials + #0GBridge #BuildOn0G

**Success Metrics**:
- African pattern detection accuracy >90%
- User engagement with African fashion vertical >20% of sessions
- Curator adoption: ≥2 African fashion specialists onboarded

#### Wave 5: Growth & Next-Stage Roadmap (August 8–21)
**Goal**: Pitch for Demo Day, get $12,500 in 0G Credits

**Deliverables**:
- [ ] Pitch deck: "Decentralized AI for African Fashion — OnPoint + 0G"
- [ ] Growth roadmap: Expand to 15K+ African fashion images, regional payment integration
- [ ] Investment readiness: Unit economics, market size (African fashion $31B market)
- [ ] Demo Day preparation: 3-minute pitch video
- [ ] Public X post with Demo Day preview + #0GBridge #BuildOn0G

**Demo Day Pitch Structure** (3 minutes):
1. **Problem**: AI fashion tools don't understand African patterns (Ankara, Kente, etc.)
2. **Solution**: Fine-tuned model on 0G Compute — accurate African fashion analysis
3. **Traction**: Live on OnPoint, X Curators onboarded, Y African fashion sessions
4. **Differentiation**: Only AI styling agent with African pattern expertise
5. **Ask**: $50K in 0G Credits → expand dataset, onboard more Curators, regional payments

---

## Core Principles — 0G Integration Checklist

Before every 0G-related change, verify:

- [ ] **ENHANCEMENT FIRST**: Are we enhancing an existing component, not creating a new one?
- [ ] **CONSOLIDATION**: Can we delete/deprecate something instead of adding?
- [ ] **PREVENT BLOAT**: Does this pass the "audit before add" test?
- [ ] **DRY**: Is there a single source of truth for this logic?
- [ ] **CLEAN**: Are dependencies explicit and separation of concerns clear?
- [ ] **MODULAR**: Is this composable, testable, and independent?
- [ ] **PERFORMANT**: Does this use adaptive loading, caching, or resource optimization?
- [ ] **ORGANIZED**: Does this follow predictable file structure with domain-driven design?

---

## Phases — Continuing Work

### Phase 11: Curator Primitive & Stylist Storefronts ✅ COMPLETE
> **ADRs**: [0002](./adr/0002-curator-primitive.md), [0003](./adr/0003-storage-strategy.md)

**Completed**:
- [x] Wanja seeded into `curators` config (10 Premier League/La Liga SKUs with M-Pesa pricing)
- [x] `/s/[slug]` storefront with working WhatsApp + M-Pesa checkout
- [x] `/s/[slug]/intel` curator intelligence page (retail signals, funnel stats, market products)
- [x] On-chain economics panel in `/lab` (sub-cent tx cost proof, Celo wallet link)
- [x] Intelligence link in storefront header
- [x] WhatsApp chat-ops agent-server with full inventory management flow
- [x] WhatsApp ingest pipeline (media upload → listing creation in Neon + R2)
- [x] WhatsApp receipt sending via Meta Cloud API (sendWhatsAppMessage)
- [x] Health check endpoint at `/api/agent/whatsapp/health`
- [x] Setup guide: `docs/guides/whatsapp-setup.md`

**Remaining** (deferred — not blocking 0G focus):
- [ ] Create Meta Business Account at business.facebook.com
- [ ] Register WhatsApp phone number in Meta Developer Portal
- [ ] Generate permanent `WA_ACCESS_TOKEN` and get `WA_PHONE_NUMBER_ID`
- [ ] Complete Meta Business verification (upload business docs)
- [ ] Set env vars on Hetzner: `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`
- [ ] Configure webhook in Meta dashboard → agent-server
- [ ] Verify end-to-end: WhatsApp → ingest → listing → storefront
- [ ] Delete global `CATALOG`, scope reads by Curator slug

**Success criteria**:
- ≥3 of 5 Curators see >20% share → visit rate
- ≥15% try-on → purchase conversion
- ≥1 cross-Curator attributed purchase/week
- Zero new features without named Curator request

---

### Phase 12: Bright Data Retail Intelligence ✅ COMPLETE
> **ADR**: [0004](./adr/0004-brightdata-web-intelligence.md)

**Completed**:
- [x] `brightdata_client.py` — SERP API + Web Unlocker
- [x] Parallel Tier 2.5 with TinyFish
- [x] Market signals (product gap, competitor price, availability)
- [x] Demo fixtures for offline judging

---

### Phase 9: Auth0 Token Vault Integration ⏸️ PAUSED
> **Hackathon**: [Authorized to Act](https://authorizedtoact.devpost.com/)

**Status**: Paused — not blocking 0G focus. Resume after Buildathon.

**Remaining tasks**:
- [ ] Auth0 login as primary entry for agentic features
- [ ] Granular scopes: `shopping:read`, `shopping:write`, `shopping:purchase`
- [ ] Token Vault for third-party retailers (FARFETCH, SSENSE, Zara)
- [ ] Permission Dashboard UI
- [ ] Just-in-Time consent flow
- [ ] Step-up auth for >$50 transactions

---

### Phase 14: Agent Spending Controls ⏸️ PAUSED
> **ADR**: [0005](./adr/0005-agent-spending-controls.md)

**Status**: Paused — not blocking 0G focus. Resume after Buildathon.

**Deliverables**:
- [x] Policy summary UI in the agent wallet panel: daily caps, approval threshold, allowed actions, and first editable presets
- [ ] Curator/merchant allowlist for autonomous purchases
- [ ] Action-specific limits for browse, reserve, tip, buy, mint
- [ ] Signed audit log visible from the wallet/agent panel
- [ ] Step-up approval for high-value or unfamiliar merchants
- [ ] Decide whether signing-layer enforcement via OWS is required before expanding autonomous purchase limits

---

### Phase 13: Content & Affiliate Monetization ⏸️ PAUSED
> **Context**: Skimlinks rejected initial application due to insufficient original content and missing About page. These are now live — reapply after traffic builds.

**Status**: Paused — not blocking 0G focus. Resume after Buildathon.

**Completed**:
- [x] `/about` page with mission, story, three pillars, and team identity (meets Skimlinks transparency requirement)
- [x] 10 original style guide articles (football kits, Ankara, streetwear, vintage, formal wear, sneaker care, sustainable fashion, accessories, plus-size, occasion wear) — 400-700 words each
- [x] `/guides` index page listing all guides
- [x] OG images + enhanced meta descriptions on all 10 guide pages
- [x] Sitemap covering all pages (total 20+ URLs)
- [x] Navigation updated (Guides + About links in header and footer)
- [x] Privacy policy page at `/privacy` for affiliate compliance
- [x] Affiliate disclosure in privacy policy (Skimlinks, ShareASale)

**Remaining**:
- [ ] Apply to ShareASale (now integrated with Awin) at ui.awin.com/publisher-signup — use site description that highlights original content + fashion commerce intent
- [ ] Reapply to Skimlinks after content threshold is met
- [ ] Monitor ShareASale/Awin approval; fall back to Impact.com if rejected

**Success criteria**:
- ≥1 affiliate network approved
- Guide pages drive ≥5% of site traffic within 60 days
- SEO-visible with indexed sitemap

---

## Celo Onchain Agents Hackathon ✅ COMPLETE

> **Deadline**: June 15, 2026 (9 AM GMT) · **Prize pool**: $5K CELO across 3 tracks

**Status**: Submitted. Results pending.

---

## Upcoming (Post-0G Buildathon)

### Short-term (Q4 2026)
- [ ] Premium persona unlock flow with payment
- [ ] Agent wallet top-up interface
- [x] Email notifications — style recap email, score milestone, streak reminders (`lib/services/email/index.ts`, `NotificationBell`)
- [x] Saved looks gallery with sharing — analysis history store + LookCrafter polaroid download + referral-enhanced share links
- [ ] Mobile app prototype (React Native)

### Medium-term (Q1 2027)
- [ ] Creator marketplace (stylist profiles)
- [ ] Custom persona creation (train on your style)
- [ ] Multi-agent collaboration (stylist + shopper)
- [x] African pattern library integration ← **0G Buildathon delivers this**
- [ ] Regional payment methods (M-Pesa, Flutterwave)

---

## Post-MVP

### Technical Debt
- [ ] Migrate from sessionStorage to Zustand/Jotai
- [ ] Extract persona config to database
- [ ] Add E2E tests (Playwright)
- [ ] Set up Sentry for error tracking
- [ ] Optimize bundle size (<300KB target)
- [ ] Add Storybook for component docs

### Creator Economy
> Deferred until ≥10 Curators ship.

- Public Curator directory
- Self-serve Curator signup + Stripe Connect
- Collaborative Curator-to-Curator drops
- Community-driven curation with rewards

### African Differentiation ← **0G Buildathon accelerates this**
- African pattern library with cultural metadata ← **Delivered by Wave 3**
- AI model training on 15K+ African fashion images ← **Delivered by Wave 2**
- Regional style classification (Ankara, Kente, Adire, Bogolan, Shweshwe) ← **Delivered by Wave 3**
- Pan-African payment integration

### Scaling & Hardening
- Formal smart contract audits
- Blue-green deployment with auto-rollback
- Performance targets: <2s page load, <30s mint confirmation

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Page load time | < 2s | ✅ |
| AI response latency | < 500ms | ✅ |
| Hero → Try-On | > 40% | 📊 |
| Persona selection | > 70% | 📊 |
| Agent wallet checkout | > 15% | 📊 |
| Curator: share → visit | > 20% | ✅ Phase 11 |
| Curator: try-on → purchase | > 15% | ✅ Phase 11 |
| Cross-Curator purchases | ≥ 1/week | 📊 Phase 11 |
| Onboarded Curators | ≥ 5 in 90 days | 📊 Phase 11 |
| LookCrafter → Try-On | > 25% | 📊 Growth |
| Referral share → return visit | > 10% | 📊 Growth |
| Weekly returning users | > 30% of DAU | 📊 Growth |
| **0G Buildathon Waves** | 5/5 complete | 🎯 Wave 1 |
| **0G Credits earned** | $50,000 | 🎯 $0 |
| **African fashion accuracy** | > 90% | 🎯 Wave 3 |
| **Demo Day** | Token2049 Singapore | 🎯 October 2026 |

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
| **0G Compute downtime** | **Fallback to Venice/Gemini/OpenAI (existing providers)** |
| **Fine-tuning fails** | **Use base model + few-shot examples as fallback** |
| **Wave deadline missed** | **Rejoin next wave — multi-wave completion rewarded** |
| **Demo Day format change** | **Prepare both in-person and virtual pitch assets** |
