# Roadmap

## Current Status: Production Beta

OnPoint is a production-ready AI styling agent with:
- **Vision-powered analysis**: Real photo analysis via Venice Vision API
- **Personality-driven critique**: 6 stylist personas (3 free, 3 premium)
- **Agent wallet shopping**: Self-custodial wallet with $5-$5K spend limits
- **Live AR sessions**: Real-time Gemini Live streaming for premium users
- **Security-first**: SIWE auth, per-user escrow, fraud detection, multi-sig
- **Multi-provider AI**: Venice, Gemini, OpenAI with automatic fallback
- **Verifiable actions**: Cryptographic signing + IPFS audit trails

The core "sees → judges → shops" flow is live at https://beonpoint.netlify.app with backend API on Hetzner VPS.

---

## In Progress

### Phase 11: Curator Primitive & Stylist Storefronts 🎯 Current
> **ADRs**: [0002](./adr/0002-curator-primitive.md), [0003](./adr/0003-storage-strategy.md)

Reframes OnPoint from "consumer AI stylist" to "curator-first styling platform" with **chat-ops admin** for sole traders. Human Curators bring catalogs + audiences; AI Curators act as cross-vertical sidekicks. Both share one `Curator` schema.

**Core deliverables:**
- `/s/[slug]` — branded storefront composing shipped components
- WhatsApp chat-ops admin for inventory management
- AI Curator "second opinion" voices on human storefronts
- Self-serve Curator onboarding at `/curator/onboard`
- Cross-Curator recommendations with attribution

**Remaining tasks:**
- [ ] Wanja seeded into `curators` table (top 10 SKUs as `listings`)
- [ ] Twilio number + Meta WhatsApp Business registration
- [ ] Meta Business verification + outbound message templates
- [ ] Delete global `CATALOG`, scope reads by Curator slug

**Success criteria:**
- ≥3 of 5 Curators see >20% share → visit rate
- ≥15% try-on → purchase conversion
- ≥1 cross-Curator attributed purchase/week
- Zero new features without named Curator request

---

### Phase 12: Bright Data Retail Intelligence 🎯
> **ADR**: [0004](./adr/0004-brightdata-web-intelligence.md)

Integrates Bright Data into the agent-web-bridge tier chain for two outputs: shopper recommendations and Curator-facing GTM intelligence.

**Completed:**
- [x] `brightdata_client.py` — SERP API + Web Unlocker
- [x] Parallel Tier 2.5 with TinyFish
- [x] Market signals (product gap, competitor price, availability)
- [x] Demo fixtures for offline judging

**Success criteria:**
- SERP returns structured product results
- Each search produces ≥1 actionable market signal
- Tier 2.5 latency ≤ 2s
- Graceful degradation when `BRIGHTDATA_API_KEY` unset

---

### Phase 9: Auth0 Token Vault Integration 🎯
> **Hackathon**: [Authorized to Act](https://authorizedtoact.devpost.com/)

**Remaining tasks:**
- [ ] Auth0 login as primary entry for agentic features
- [ ] Granular scopes: `shopping:read`, `shopping:write`, `shopping:purchase`
- [ ] Token Vault for third-party retailers (FARFETCH, SSENSE, Zara)
- [ ] Permission Dashboard UI
- [ ] Just-in-Time consent flow
- [ ] Step-up auth for >$50 transactions

---

## Upcoming

### Immediate (Next 2 Weeks)
- [ ] A/B test hero tagline variations
- [ ] Add real-time "X people trying on now" counter
- [ ] Implement persona voice previews
- [ ] Add agent wallet balance display in header
- [ ] Set up analytics dashboard (PostHog or Mixpanel)

### Short-term (Next Month)
- [ ] Premium persona unlock flow with payment
- [ ] Agent wallet top-up interface
- [ ] Email notifications for agent purchases
- [ ] Saved looks gallery with sharing
- [ ] Mobile app prototype (React Native)

### Medium-term (Next Quarter)
- [ ] Creator marketplace (stylist profiles)
- [ ] Custom persona creation (train on your style)
- [ ] Multi-agent collaboration (stylist + shopper)
- [ ] African pattern library integration
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

### African Differentiation
- African pattern library with cultural metadata
- AI model training on 15K+ African fashion images
- Regional style classification (Ankara, Kente, Adire, Bogolan, Shweshwe)
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
| Curator: share → visit | > 20% | 📊 Phase 11 |
| Curator: try-on → purchase | > 15% | 📊 Phase 11 |
| Cross-Curator purchases | ≥ 1/week | 📊 Phase 11 |
| Onboarded Curators | ≥ 5 in 90 days | 📊 Phase 11 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| AI provider downtime | Multi-provider fallback (Venice → Gemini → OpenAI) |
| Redis unavailable | In-memory cache with fire-and-forget persistence |
| Smart contract bugs | OpenZeppelin libraries, multi-sig, emergency pause |
| IPFS reliability | Lighthouse pinning with CDN caching |
| Agent wallet depletion | Per-user escrow, spend limits, auto-funding |
| Fraud & abuse | Dead Man's Switch, anomaly detection, freezing |
