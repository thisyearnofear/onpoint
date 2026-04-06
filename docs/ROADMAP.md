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

### Next Priorities (Q2 2026)

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
- Stylist directory and profiles
- Creator storefronts with custom revenue splits
- Collaborative design workflows
- Community-driven curation with rewards

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
