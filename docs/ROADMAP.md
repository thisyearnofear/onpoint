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

**Completed:**
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

**Remaining tasks:**
- [ ] Create Meta Business Account at business.facebook.com
- [ ] Register WhatsApp phone number in Meta Developer Portal
- [ ] Generate permanent `WA_ACCESS_TOKEN` and get `WA_PHONE_NUMBER_ID`
- [ ] Complete Meta Business verification (upload business docs)
- [ ] Set env vars on Hetzner: `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`
- [ ] Configure webhook in Meta dashboard → agent-server
- [ ] Verify end-to-end: WhatsApp → ingest → listing → storefront
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

### Phase 14: Agent Spending Controls 🎯
> **ADR**: [0005](./adr/0005-agent-spending-controls.md)

Make agent autonomy legible and enforceable before raising purchase limits.
OWS remains optional backend infrastructure; the user-facing feature is the
policy surface.

**Deliverables:**
- [x] Policy summary UI in the agent wallet panel: daily caps, approval threshold, allowed actions, and first editable presets
- [ ] Curator/merchant allowlist for autonomous purchases
- [ ] Action-specific limits for browse, reserve, tip, buy, mint
- [ ] Signed audit log visible from the wallet/agent panel
- [ ] Step-up approval for high-value or unfamiliar merchants
- [ ] Decide whether signing-layer enforcement via OWS is required before expanding autonomous purchase limits

---

## Celo Onchain Agents Hackathon Sprint 🏆
> **Deadline**: June 15, 2026 (9 AM GMT) · **Prize pool**: $5K CELO across 3 tracks
> **Tracks**: Best Agent ($2.5K/$1K/$500) · Most Activity ($500) · Highest 8004scan Rank ($500)
> **Judging**: ecosystem alignment + consistent onchain transactions + real-world utility + Self Agent ID

### 4-Day Sprint Plan (re-prioritized for judge scoring)

The consumer funnel is now editorial (growth plan shipped). This sprint makes the bottom of the funnel produce **real onchain transactions** — the primary scoring criterion.

#### Day 1: Onchain Transaction Flows
- [ ] Agent tip flow end-to-end — user tips AI stylist in cUSD, receipt on IPFS (simplest tx demo)
- [ ] Premium persona unlock — gate 3 premium personas behind subscription tier, upgrade CTA in picker
- [ ] Agent wallet top-up UI — re-add AddFundsButton + balance card (requires ETHERFUSE_API_KEY)

#### Day 2: Curator Commerce + Trust Surface
- [ ] Curator merchant allowlist — trusted merchants auto-execute, unknown merchants require approval
- [ ] Autonomous purchase demo — agent buys $35 jersey from Wanja on /s/wanja, Celo tx in audit log <30s
- [ ] Audit log in wallet panel — timestamp, action, amount, tx hash, explorer link, IPFS receipt link

#### Day 3: Ecosystem Alignment Polish
- [ ] Trust protocol attestation — sign Celo message with ERC-8004 + Self Protocol, surface badge in /lab
- [ ] MiniPay auto-connect — use farcaster-miniapp-wagmi-connector when isMiniPay, fee abstraction toast
- [ ] Demo recording + submission draft

#### Day 4: Submit
- [ ] Install Celo Builders skill: `npx skills add https://celobuilders.xyz`
- [ ] Submit via agent: "Help me submit my project to the Celo Onchain Agents Hackathon"
- [ ] Verify submission on 8004scan

### Demo Script (what judges see)
1. Editorial landing page → LookCrafter → polaroid → share (viral loop, conversion)
2. Real photo with free persona → score → **tip agent in cUSD** (onchain tx #1)
3. /s/wanja storefront → agent finds jersey → **auto-buys under threshold** → Celo tx in audit log (onchain tx #2 + real-world utility)
4. User hits persona limit → **upgrades to Plus** → premium persona unlocked (product maturity)
5. Agent identity badge shows **ERC-8004 + Self Protocol + trust attestation** (ecosystem alignment)

### Explicitly NOT doing (4 days is tight)
- Auth0 as primary entry (infrastructure, not demo-visible enough)
- Module extraction (developer experience, judges don't score on it)
- Affiliate applications (weeks of waiting, no onchain activity)
- Mobile app prototype (too late for this hackathon)
- Creator marketplace (premature — defer to ≥10 Curators per ADR 0002)

### Priority 2: Surface Retail Intelligence (10% of effort) ✅ Done
Turn styling sessions into commercial feedback for curators.

- [x] `/s/[slug]/intel` page showing product gap signals from storefront visitors
- [x] Competitor pricing from Bright Data on curator intel page
- [x] Recommended merchandising actions backed by live web evidence

### Priority 3: Prove On-Chain Economics (10% of effort) ✅ Done
Document and demonstrate Celo's sub-cent advantage.

- [x] On-Chain Economics panel in `/lab` showing live tx costs from recent agent actions
- [x] Average gas costs displayed: agent shopping, receipts, commission splits
- [ ] Trust protocol integration for portable on-chain identity

### Competitive Advantages Already Shipped
- ✅ ERC-8004 agent registration (9177 on Celo)
- ✅ Self Protocol identity + dual verification
- ✅ Agent wallet with $5-$5K spend limits
- ✅ Autonomous execution (sub-$5 auto-execute)
- ✅ IPFS/Filecoin verifiable receipts
- ✅ Commission splits (85/10/3/2) with cUSD/USDT
- ✅ MiniPay integration (auto-connect, fee abstraction)

### What Judges Want
1. **Practical utility** — Wanja's storefront solves a real problem for a real merchant
2. **Sub-cent tx costs** — Celo gas is already cheap; prove it with live data
3. **Verifiable identity** — Self Protocol + ERC-8004 + trust protocol = triple verification
4. **Reusable modules** — Extract style-analysis, web-discovery, verifiable-receipts as composable skills
5. **Immediate user base** — Curators bring their own customers to the platform

---

## Upcoming

### Immediate (Aligned with Hackathon Sprint)
- [x] Set up analytics dashboard (PostHog integrated — event tracking for try-ons, shares, persona selection, referral landings)
- [ ] Document sub-cent transaction costs with live dashboard
- [ ] Polish MiniPay auto-connect and fee abstraction UX
- [ ] Extract reusable agent skill modules (style-analysis, web-discovery, verifiable-receipts)

### Phase 13: Content & Affiliate Monetization 🎯
> **Context**: Skimlinks rejected initial application due to insufficient original content and missing About page. These are now live — reapply after traffic builds.

**Completed:**
- [x] `/about` page with mission, story, three pillars, and team identity (meets Skimlinks transparency requirement)
- [x] 10 original style guide articles (football kits, Ankara, streetwear, vintage, formal wear, sneaker care, sustainable fashion, accessories, plus-size, occasion wear) — 400-700 words each
- [x] `/guides` index page listing all guides
- [x] OG images + enhanced meta descriptions on all 10 guide pages
- [x] Sitemap covering all pages (total 20+ URLs)
- [x] Navigation updated (Guides + About links in header and footer)
- [x] Privacy policy page at `/privacy` for affiliate compliance
- [x] Affiliate disclosure in privacy policy (Skimlinks, ShareASale)

**Remaining:**
- [ ] Apply to ShareASale (now integrated with Awin) at ui.awin.com/publisher-signup — use site description that highlights original content + fashion commerce intent
- [ ] Reapply to Skimlinks after content threshold is met
- [ ] Monitor ShareASale/Awin approval; fall back to Impact.com if rejected

**Success criteria:**
- ≥1 affiliate network approved
- Guide pages drive ≥5% of site traffic within 60 days
- SEO-visible with indexed sitemap

### Short-term (Post-Hackathon)
- [ ] Premium persona unlock flow with payment
- [ ] Agent wallet top-up interface
- [x] Email notifications — style recap email, score milestone, streak reminders (`lib/services/email/index.ts`, `NotificationBell`)
- [x] Saved looks gallery with sharing — analysis history store + LookCrafter polaroid download + referral-enhanced share links
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
| LookCrafter → Try-On | > 25% | 📊 Growth |
| Referral share → return visit | > 10% | 📊 Growth |
| Weekly returning users | > 30% of DAU | 📊 Growth |

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
