# Roadmap

## Current Status: MVP Beta

OnPoint is a functional AI styling agent with live sessions, smart shopping, spending controls, and web discovery. The core agent loop (perceive → reason → act) is production-ready.

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

---

## In Progress

### Multi-Chain Expansion 🚧
- Base ecosystem integration
- Polygon support
- Cross-chain transaction aggregation

### Production Readiness 🚧
- SIWE (Sign-In with Ethereum) + JWT sessions
- User-funded escrow contracts
- Tiered subscription billing
- Fraud prevention (Dead Man's Switch, multi-sig)

---

## Post-MVP Roadmap

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

| Metric | Target |
|--------|--------|
| Page load time | < 2 seconds |
| AI response latency | < 500ms (Gemini), < 3s (Venice) |
| Session completion rate | > 60% |
| Suggestion acceptance rate | > 25% |
| Uptime | 99.9% |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| AI provider downtime | Multi-provider fallback (Venice → Gemini → OpenAI) |
| Redis unavailable | In-memory cache with fire-and-forget persistence |
| Smart contract bugs | OpenZeppelin libraries, multi-sig controls, emergency pause |
| IPFS reliability | Lighthouse pinning with CDN caching |
| User adoption | Farcaster community launch, Memory Protocol rewards |
