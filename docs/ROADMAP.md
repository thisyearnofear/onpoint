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

## Completed Phases

### Phase 1: MVP Foundation ✅
- Next.js web application with AI fashion critique
- Virtual try-on implementation
- Wallet connection (RainbowKit + Wagmi)
- Enhanced Catalog UI (CardEnhanced, ShopGrid, EngagementBadge)
- Social proof metrics and micro-animations

### Phase 2: Agent Infrastructure ✅
- Agent Controls middleware (spending limits, approvals)
- Commission split architecture (4-tier revenue distribution)
- State persistence layer (Redis with in-memory fallback)
- Suggestion Toast system (time-bounded proposals)
- Style Memory + recommendations

### Phase 2.5: Gemini Live Integration ✅
- Real-time WebSocket streaming for premium sessions
- Tactical HUD with Agent Reasoning Terminal
- CELO payment flow for session access
- BYOK (Bring Your Own Key) support

### Phase 3: Social & Community ✅
- Farcaster Mini App integration
- Memory Protocol identity graphs
- Social activity tracking and rewards
- Cross-platform user discovery

### Phase 4: Agent Web-Agency ✅
- Python FastAPI bridge microservice
- Browser Use Cloud V3 integration
- 3-tier discovery engine (catalog → API → web)
- Live URL monitoring in UI

### Phase 5: Verifiable Agency ✅
- Cryptographic agent signing (WDK wallet)
- Decentralized audit trails (IPFS/Filecoin via Lighthouse)
- Public receipt viewing in the UI
- ERC-8004 compliance

### Phase 6: Production Security & Economics ✅
- **Authentication**: SIWE (EIP-4361) with nonce management and replay protection
- **Escrow System**: Per-user, per-agent Redis-backed balance tracking with allowances
- **Subscription Engine**: 4-tier system (Free, Basic $9.99, Pro $29.99, Concierge $99.99)
- **Fraud Prevention**: Dead Man's Switch, anomaly detection, multi-sig for >$500 transactions
- **Treasury Management**: Automated revenue tracking, expense monitoring, auto-funding

### Phase 7: UX Consolidation & Design Enhancement ✅
- **Feature Consolidation**: Removed 8 bloat features, reduced VirtualTryOn by 60%
- **Persona System**: 3 free stylists (Miranda/Edina/Tan) + 3 premium unlockable
- **Unified Flow**: Upload → Analyze → Choose Persona → Critique → Shop
- **Design System**: Unified color scheme (primary/accent), consistent theming across all pages
- **Agent Wallet Messaging**: Clear "sees → judges → shops" value prop throughout UI
- **Mobile Optimization**: Responsive persona grids, improved CTA hierarchy

### Phase 8: Backend Infrastructure ✅
- **Hetzner VPS**: Production API at https://api.onpoint.famile.xyz
- **Venice Vision API**: Real photo analysis with qwen3-vl-235b-a22b model
- **CORS & Payload**: Nginx configuration for 50MB uploads, proper header management
- **PM2 Ecosystem**: Process management with environment variable loading

---

## In Progress

### Multi-Chain Expansion 🚧
- Base ecosystem integration
- Polygon support
- Cross-chain transaction aggregation

### Analytics & Monitoring 🚧
- User journey tracking (hero → try-on → shop → checkout)
- Persona selection distribution metrics
- Agent wallet usage patterns
- Conversion funnel optimization

### Phase 0 (ADR 0001): Deploy Pipeline 🚀 ✅
> Deploy pipeline to make Hetzner the agent's home base. See [ADR 0001](./adr/0001-backend-first-autonomy.md).

- [x] **`scripts/deploy-api.sh`** — build → rsync → symlink flip → PM2 reload → health check → auto-rollback
- [x] **`scripts/rollback-api.sh`** — interactive release picker with auto-revert on failure
- [x] **`scripts/setup-secrets.sh`** — secure hidden-input secret loader (SSH pipe, never local)
- [x] **`shared/api/.env`** — single source of truth for secrets, symlinked into each release
- [x] **`pnpm deploy:api`** — convenience npm script
- [x] **`pm2 save && pm2 startup`** — process lineup survives reboot
- [x] **`.github/workflows/deploy-api.yml`** — auto-deploy on master pushes (needs GH Secrets)
- [x] **Live deploy verified** — release 20260526-130237 passing health checks

### Phase 3 (ADR 0001): Port Agent Routes to Hetzner 🚀 ✅
> All 16 stateful agent endpoints migrated from Vercel Next.js route handlers to Hetzner Express.
> Backed by `@repo/agent-core` (CJS via tsup). See [ADR 0001](./adr/0001-backend-first-autonomy.md).

- [x] **16 routes ported** — dashboard, wallet, identity, suggestion, approval, style, tip, tip-agent, fraud, mint, purchase, checkout, escrow, treasury, missions, schedule-event
- [x] **`@repo/agent-core`** — workspace package with CJS build (tsup) for Express compatibility
- [x] **`@repo/blockchain-client`** + **`@onpoint/shared-types`** — CJS builds for Express
- [x] **`forwarded-user.js` middleware** — extracts Vercel auth context from forwarded headers
- [x] **Deploy scripts updated** — `pnpm deploy --legacy` replaces `npm install --production` for workspace dep resolution
- [x] **Sentry integration** — optional, conditional on SENTRY_DSN
- [x] **Agent proxy catch-all** — simplified, falls back to Vercel only for unmatched routes
- [x] **Server verified** — 94 middleware layers load cleanly

### Autonomous Agent Infrastructure ✅
> **Hackathon**: Celo Proof of Ship Season 2 — AI Agent Track

OnPoint now executes agent suggestions **autonomously onchain** with full verifiable receipts.

#### Completed
- [x] **Self Protocol Integration** — Agent registered with Self Agent ID (`onpoint-agent-35962`)
  - `lib/services/self-protocol.ts` — registration + verification
  - `GET /api/agent/identity` — unified ERC-8004 + Self identity
- [x] **Autonomous Execution Engine** — Suggestions execute onchain without manual steps
  - `lib/services/autonomous-executor.ts` — `executeSuggestion()` signs + broadcasts
  - Auto-executes below-threshold suggestions immediately
  - Manual-accepted suggestions trigger onchain execution via PATCH
  - Supports `mint`, `purchase`, `tip` with full receipt logging
- [x] **Agent Heartbeat Loop** — Self-monitoring endpoint
  - `POST /api/agent/heartbeat` — gas checks, fraud heartbeat, proactive tasks
  - `GET /api/agent/heartbeat` — public health status
- [x] **Agent Dashboard** — Public transparency for judges
  - `GET /api/agent/dashboard` — wallet health, receipt count, compliance flags
- [x] **Verifiable Receipts in All Flows** — Mint, purchase, checkout all record receipts
  - Signed by agent wallet, uploaded to IPFS, optional Celo memo tx

### Phase 9: Auth0 for AI Agents — Token Vault Integration 🎯
> **Hackathon**: [Authorized to Act](https://authorizedtoact.devpost.com/) — $10,000 prize pool

OnPoint is evolving from a vision-AI stylist to a fully autonomous shopping agent. To do this safely, we are integrating **Auth0's Token Vault**. This ensures that while the agent "acts" on behalf of the user (browsing catalogs, adding to carts, checking out), it never directly touches sensitive third-party credentials or OAuth tokens.

#### The Rationale: Why OnPoint + Token Vault?
- **Delegated Authority**: OnPoint's agent needs to access private user data on third-party fashion sites (order history, sizing, loyalty points) and perform actions (purchase). Token Vault provides the secure bridge for this delegation.
- **Credential Isolation**: By using Token Vault, the AI agent (which may be subject to prompt injection or model hallucinations) is never in possession of the raw access tokens. It only receives a "blind" capability to call specific APIs.
- **Trust-Based Commerce**: For users to trust an agent with their credit card or shopping accounts, there must be a visible, revocable, and fine-grained permission layer. Auth0 provides this out-of-the-box.

#### Full Implementation Plan

**1. Secure Identity & Scoped Authorization (Auth0 Login)**
- [ ] Implement Auth0 login flow as the primary entry point for agentic features.
- [ ] Define granular scopes for agent actions: `shopping:read` (catalog), `shopping:write` (cart), `shopping:purchase` (checkout).
- [ ] Map Auth0 User IDs to OnPoint's existing SIWE-based wallet identities.

**2. Token Vault Integration for Third-Party APIs**
- [ ] Set up Auth0 Token Vault to store OAuth tokens for major retailers (e.g., FARFETCH, SSENSE, Zara).
- [ ] Implement the "Agent-Mediated API Call" pattern:
    - Agent requests an action (e.g., "Add to cart on Zara").
    - Backend fetches the scoped token from Auth0 Token Vault.
    - Backend executes the request on behalf of the agent.
    - Token is never exposed to the AI model or frontend.

**3. Intent-Based User Consent & UX**
- [ ] Build a "Permission Dashboard" where users can see which retailers the agent is authorized to access.
- [ ] Implement a "Just-in-Time" consent flow: if the agent suggests a product from a new retailer, the UI triggers an Auth0-backed consent screen.
- [ ] Add visual indicators in the Agent Terminal showing when a secure Token Vault call is being made.

**4. Step-Up Authentication for High-Stake Actions**
- [ ] Trigger Auth0 Step-Up Authentication (MFA/Biometric) for any transaction exceeding $50 or for "One-Click Buy" requests.
- [ ] Integrate with existing multi-sig and "Dead Man's Switch" fraud prevention logic.

#### Judging Criteria Alignment Table

| Criteria | OnPoint Implementation Strategy |
|----------|-------------------------------|
| **Use of Technology** | **Core Integration**: Using Auth0 Token Vault to manage 3rd-party fashion API tokens (Zara, SSENSE). Agent calls APIs via the Vault, ensuring credential isolation. |
| **Project Use Case** | **Agentic Commerce**: A real-world use case where an AI agent acts as a personal shopper, navigating the web and checking out using delegated authority. |
| **Usability & UX** | **Transparent Control**: A dedicated "Agent Permissions" UI allows users to grant, view, and revoke access to specific stores with one click, powered by Auth0 Consent. |
| **Creativity & Innovation** | **Agent-Led Shopping**: Combining Venice Vision AI (style analysis) with Auth0 (secure execution) to create the first "Trustless Personal Shopper" that can't "steal" your tokens. |

---

### Phase 10: Multi-Chain Expansion 🅿️ Deferred
> Moved to Post-MVP. Does not serve the Curator loop (ADR 0002). Revisit when cross-chain volume is evidenced by Curator demand.

- Base ecosystem integration
- Polygon support
- Cross-chain transaction aggregation

---

### Phase 11: Curator Primitive & Stylist Storefronts 🎯 Current
> **ADRs**: [0002 — Curator Primitive](./adr/0002-curator-primitive.md), [0003 — Storage Strategy](./adr/0003-storage-strategy.md)
> **North star**: Wanja — a sole-trader Premier League jersey reseller — manages her storefront purely by texting our agent on WhatsApp. Her customers land on `/s/wanja`, try-on, get a polaroid, share, and tap "Buy on WhatsApp." AI Curator personas (Miranda, Edina…) join the conversation as optional sidekicks.

Reframes OnPoint from "consumer AI stylist" to "curator-first styling platform" with **chat-ops admin** for sole traders. Human Curators bring catalogs + audiences; AI Curators act as cross-vertical sidekicks. Both share one `Curator` schema. No new try-on / gallery / share components — `/s/[slug]` composes shipped ones. Backend on Hetzner (per [ADR 0001](./adr/0001-backend-first-autonomy.md)) owns the agent, Spectrum-ts messaging, Neon writes, and R2 ingest; Vercel/Netlify is read-only presentation.

#### Alignment with Core Principles
- **ENHANCEMENT FIRST**: `/s/[slug]` reuses `VirtualTryOn`, `PolaroidGallery`, `SessionEndingCard`, `collage`. No new feature surface.
- **AGGRESSIVE CONSOLIDATION**: `persona-config.ts` + implicit merchant concept collapse into one `Curator` schema. Global `CATALOG` in `storefront/route.ts` is deleted.
- **PREVENT BLOAT**: New work must be requested by a named Curator with a named customer-of-theirs lined up to use it.
- **DRY**: One Curator schema feeds storefront, persona picker, share branding, revshare attribution.
- **CLEAN**: Layer 1 (engine) / Layer 2 (Curators) / Layer 3 (loop) — agent/web3 surface moves behind `/lab`.

#### Sequencing (12 weeks)

| Weeks | Goal | Build | Defer |
|---|---|---|---|
| **1–2** | Wanja's chat-ops admin + bare storefront live on Hetzner | Curator schema (`packages/shared-types`); Neon + R2 provisioned, secrets on Hetzner via `setup-secrets.sh`; PL kit backbone (20 clubs × current season × 3 kit types); Spectrum-ts WhatsApp agent under PM2 with 5 commands; `/s/wanja` reading from Neon, "Buy on WhatsApp" deep links | Try-on, AI sidekick, multi-Curator, additional channels |
| **3–4** | Layer try-on + one great share asset | `VirtualTryOn` accepts Curator-scoped catalog (no global `CATALOG`); polaroid template with Curator name watermark; remove auto-analyze for unauth visitors | IG-story + fit-check templates (until polaroid data justifies more) |
| **5–6** | AI as sidekick on `/s/wanja` | Wire 1–2 AI Curators from `persona-config.ts` as optional "second opinion"; AI recommendations scoped to Wanja's catalog | Cross-Curator catalog jumps |
| **7–8** | 4 more Curators across verticals | Concierge onboarding: sneakers, Ankara tailor, hair/barber, vintage. WhatsApp + Telegram via Spectrum-ts. Reuse PL-style backbone pattern per vertical | Self-serve Curator signup, public directory |
| **9–10** | Cross-Curator graph | AI Curators recommend across union of human Curator catalogs with attribution + revshare via existing agent receipts (Lighthouse) | Public Curator marketplace |
| **11–12** | Measure & price | Share → visit → try-on → purchase funnel per Curator; A/B SaaS vs revshare vs AI-session split; per-Curator R2 storage cost report | New verticals not validated by data |

#### Schema (lives in `packages/shared-types`)

```ts
interface Curator {
  slug: string;
  name: string;
  type: "human" | "ai";
  avatar?: string;
  voice?: string;                  // prompt seed for AI; bio for human
  verticals: string[];
  collaborators?: string[];
  channels?: { whatsapp?; telegram?; instagram? };   // chat-ops admin lives here
  brand?: { logo?; colors?; frameTemplate?; shareCopy?; location? };  // all optional for sole traders
  commerce?: { checkout: "whatsapp"|"shopify"|"stripe"; checkoutUrl?; whatsappTemplate?; revShare? };
}
```

Inventory is **not** in the Curator object — it lives in Neon (`listings` joined to `kit_skus`), per [ADR 0003](./adr/0003-storage-strategy.md).

#### Concrete deliverables (Wks 1–2)

**Infrastructure (Hetzner)**
- [ ] Neon project provisioned; secrets loaded onto Hetzner via `scripts/setup-secrets.sh` (per ADR 0001)
- [ ] Cloudflare R2 bucket + Images access; secrets onto Hetzner same path
- [ ] `packages/db/` — Drizzle schema + migrations for `curators`, `kit_skus`, `listings`, `orders`, `sessions`
- [ ] `packages/storage/` — R2 helpers: `put(key, bytes)`, `signedReadUrl(key)`, `transformUrl(key, opts)`

**Schema + seeds**
- [ ] `packages/shared-types/curator.ts` — single `Curator` type (see above)
- [ ] PL kit backbone seed: 20 clubs × 2024/25 × {home, away, third} with official image keys in R2
- [ ] `apps/web/lib/utils/persona-config.ts` → emits `Curator` objects with `type: "ai"`
- [ ] Wanja seeded into `curators` table from her onboarding call (top 10 SKUs as `listings`)

**Chat-ops admin (Hetzner)**
- [ ] Twilio number provisioned and registered with Meta's WhatsApp Business Cloud API as the agent's WhatsApp line
- [ ] `packages/messaging-bridge/` — Spectrum-ts wrapper, providers: WhatsApp Business, terminal (for dev)
- [ ] `apps/api/agent-server` — Spectrum-ts agent server under PM2, using `@repo/agent-core` for tools
- [ ] 5 commands implemented: `+ <club> <type> <size> <price> <qty>`, `-`, `stock`, `link`, `help`
- [ ] WhatsApp ingest tool: download Meta media → R2 put → insert `listings` row (synchronous within webhook window)
- [ ] Meta Business verification started + outbound message templates submitted for approval

**Customer surface**
- [ ] `apps/web/app/s/[slug]/page.tsx` — reads Curator + listings from Hetzner API; renders branded storefront
- [ ] `/s/wanja` live with "Buy on WhatsApp" deep links (`wa.me/{phone}?text={prefill}`) — no try-on, no AI sidekick yet

**Relocation (consolidation per Core Principles)**
- [ ] `apps/web/app/api/agent/storefront/route.ts` — delete global `CATALOG`, scope reads by Curator slug
- [ ] `apps/web/app/lab/page.tsx` — new home for existing agent/web3 surface (`TacticalDashboard` agent/wallet/fraud/missions tabs move behind here, no new code)

#### Out of scope for Phase 11
- New AI models or training
- Public Curator directory / marketplace UI (need ≥10 Curators first)
- Crypto-native checkout for end customers (off-ramp to Curator's existing Shopify/WhatsApp/Stripe)
- Removal of the agent / ERC-8004 / Token Vault stack (relocated, not deleted)

#### Success criteria (decided before measurement)
- ≥3 of 5 onboarded Curators see >20% share → visit rate on customer-generated polaroids
- ≥15% try-on → purchase conversion on at least one Curator
- ≥1 cross-Curator attributed purchase (AI recommends item from Curator B inside Curator A's storefront)
- Zero new top-level features added that weren't requested by a named Curator

---

#### Immediate (Next 2 Weeks)
- [ ] A/B test hero tagline variations
- [ ] Add real-time "X people trying on now" counter
- [ ] Implement persona voice previews
- [ ] Add agent wallet balance display in header
- [ ] Set up analytics dashboard (PostHog or Mixpanel)

#### Short-term (Next Month)
- [ ] Premium persona unlock flow with payment
- [ ] Agent wallet top-up interface
- [ ] Email notifications for agent purchases
- [ ] Saved looks gallery with sharing
- [ ] Mobile app prototype (React Native)

#### Medium-term (Next Quarter)
- [ ] Creator marketplace (stylist profiles)
- [ ] Custom persona creation (train on your style)
- [ ] Multi-agent collaboration (stylist + shopper)
- [ ] African pattern library integration
- [ ] Regional payment methods (M-Pesa, Flutterwave)

---

## Post-MVP Roadmap

### Technical Debt & Refactoring
- [ ] Migrate from sessionStorage to proper state management (Zustand/Jotai)
- [ ] Extract persona config to database (currently hardcoded)
- [ ] Implement proper error boundaries for all async operations
- [ ] Add E2E tests for critical flows (Playwright)
- [ ] Set up Sentry for error tracking
- [ ] Optimize bundle size (currently ~500KB, target <300KB)
- [ ] Add Storybook for component documentation
- [ ] Implement proper loading states for all async operations

### Creator Economy
> Subsumed by Phase 11 (Curator Primitive). What remains here is post-MVP work that only makes sense after ≥10 Curators ship.

- Public Curator directory (deferred until Phase 11 success criteria met)
- Self-serve Curator signup + Stripe Connect onboarding
- Collaborative design workflows (Curator-to-Curator drops)
- Community-driven curation with rewards (powered by existing Memory Protocol)

### African Differentiation
- African pattern library with cultural metadata
- AI model training on 15K+ African fashion images
- Regional style classification (Ankara, Kente, Adire, Bogolan, Shweshwe)
- Pan-African payment integration

### Agent-to-Agent Economy
- Agent discovery engine
- Inter-agent commerce (agents buying from agents)
- Subscription-based agent services
- Multi-sig treasury management

### Scaling & Hardening
- Formal smart contract audits
- Blue-green deployment with automatic rollback
- Comprehensive E2E test coverage
- Performance targets: <2s page load, <30s mint confirmation

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Page load time | < 2 seconds | ✅ Optimized |
| AI response latency | < 500ms (Gemini), < 3s (Venice) | ✅ Achieved |
| Session completion rate | > 60% | 📊 Tracking |
| Suggestion acceptance rate | > 25% | 📊 Tracking |
| Uptime | 99.9% | ✅ Hetzner VPS |
| Hero → Try-On conversion | > 40% | 📊 New metric |
| Persona selection rate | > 70% | 📊 New metric |
| Agent wallet checkout | > 15% | 📊 New metric |
| **Curator storefront: share → visit** | > 20% | 📊 Phase 11 |
| **Curator storefront: try-on → purchase** | > 15% | 📊 Phase 11 |
| **Cross-Curator attributed purchases** | ≥ 1/week | 📊 Phase 11 |
| **Onboarded Curators (live storefronts)** | ≥ 5 in 90 days | 📊 Phase 11 |

---

## Risk Mitigation

| Risk | Mitigation | Status |
|------|-----------|--------|
| AI provider downtime | Multi-provider fallback (Venice → Gemini → OpenAI) | ✅ Implemented |
| Redis unavailable | In-memory cache with fire-and-forget persistence | ✅ Implemented |
| Smart contract bugs | OpenZeppelin libraries, multi-sig controls, emergency pause | ✅ Multi-sig active |
| IPFS reliability | Lighthouse pinning with CDN caching | ✅ Implemented |
| User adoption | Farcaster community launch, Memory Protocol rewards | ✅ Active |
| Agent wallet depletion | Per-user escrow, spend limits, auto-funding | ✅ Implemented |
| Fraud & abuse | Dead Man's Switch, anomaly detection, freezing | ✅ Implemented |
| Subscription churn | 14-day trials, tiered pricing, clear value prop | ✅ Implemented |

---

## Recent Achievements (Last 30 Days)

### Security & Economics
- Implemented SIWE authentication with cryptographic nonce management
- Built per-user escrow system preventing platform wallet depletion
- Created 4-tier subscription engine with trial management
- Added fraud detection with Dead Man's Switch and multi-sig requirements
- Automated treasury management with revenue/expense tracking

### UX & Design
- Consolidated virtual try-on flow (60% code reduction)
- Unified color scheme across all pages (primary/accent)
- Enhanced hero section with "sees → judges → shops" messaging
- Improved mobile responsiveness for persona selection
- Added trust signals (4.7★ fit accuracy, agent wallet context)

### Infrastructure
- Deployed production API to Hetzner VPS
- Integrated Venice Vision API for real photo analysis
- Fixed CORS and 50MB payload handling
- Configured PM2 for process management
- Optimized Dependabot to reduce build minutes

### Developer Experience
- Applied Core Principles: ENHANCEMENT FIRST, CONSOLIDATION, DRY, CLEAN
- Reduced technical debt by removing bloat features
- Improved code organization and separation of concerns
- Enhanced documentation (FLOW_REDESIGN.md, CONSOLIDATION_COMPLETE.md)

### Design System & Testing Foundation 🎯
- **Dark Mode Complete**: All shared-ui components themified (CardEnhanced, EngagementBadge, ShopGrid) — hardcoded grays replaced with CSS variables
- **Toast Notification System**: Custom toast context replacing 13 alert() calls across 3 pages, with `role="alert"`, `aria-live="polite"`, `createPortal` for accessibility
- **InteractiveStylingCanvas Rewrite**: Migrated from styled-components to Tailwind CSS, fixed drag handler feedback loop (useRefs + stable useEffect), full TypeScript safety
- **EngagementBadge Theming**: Gradient colors moved to CSS custom properties (`--badge-*`) with proper dark mode fallbacks — no more hardcoded hex values
- **Style Guide Page**: New `/style-guide` route rendering all shared-ui components with live theme toggle for light/dark mode verification
- **Test Infrastructure**: Vitest configured with `@vitejs/plugin-react`, jsdom environment, first unit tests (toast system) passing — 6 tests covering context API, rendering, edge cases
- **Dependency Cleanup**: Removed styled-components dependency and compiler option from Next.js config
- **Type Safety Fixes**: Fixed OWS native module compatibility, all implicit `any` types resolved, TS strict mode compliance

### Premium Gating, Collage DnD & Connected Accounts 🎯
- **Premium Status Hook**: New `usePremiumStatus()` hook calling `/api/auth/subscription` replaces hardcoded `hasPremium = false` — premium gating now reflects real subscription state with upgrade CTAs
- **Collage Drag-and-Drop**: Full dnd-kit integration with `DraggableLibraryItem`, `DroppableCanvas`, `CanvasDraggableItem` — library items drag onto canvas, canvas items reposition by dragging with 5px activation threshold
- **Connected Accounts Nav**: Quick-access "Connected Accounts" link in mobile navigation dispatches `onpoint:navigate('settings')` custom event to open TacticalDashboard settings tab
- **Netlify Build Fix**: Moved `serverExternalPackages` from inside `experimental` to top-level `next.config.js` — fixes Turbopack `non-ecmascript placeable asset` error for `@open-wallet-standard/core`
