# Architecture

## System Overview

OnPoint is a monorepo containing a Next.js web app, AI provider abstractions, and a Python microservice for autonomous web browsing.

The product is organized as three composable layers (see [ADR 0002](./adr/0002-curator-primitive.md)):

```diagram
╭──────────────────────────────────────────────────────────────╮
│  LAYER 3 — The Loop   (consumer surface)                     │
│  Try-on → Polaroid → Share → Buy → Memory → Re-engage        │
│  Rendered on /s/[slug] by composing shipped components       │
╰────────────────────────────┬─────────────────────────────────╯
                             ▲
╭────────────────────────────┴─────────────────────────────────╮
│  LAYER 2 — The Cast   (Curators: humans + AI personas)       │
│  Single schema in @onpoint/shared-types · Curator            │
│  human  → apps/web/config/curators/*.json                    │
│  ai     → apps/web/lib/utils/persona-config.ts               │
╰────────────────────────────┬─────────────────────────────────╯
                             ▲
╭────────────────────────────┴─────────────────────────────────╮
│  LAYER 1 — The Engine                                        │
│  AI providers · try-on · persistence · payments ·            │
│  agent receipts (now: cross-Curator attribution)             │
╰──────────────────────────────────────────────────────────────╯
```

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
├─────────────────┬──────────────────┬────────────────────────┤
│   Web App       │   Chrome Ext     │   Farcaster Mini App   │
│  (Next.js 16)   │  (Built-in AI)   │   (SDK Widget)         │
└────────┬────────┴────────┬─────────┴──────────┬─────────────┘
          │                 │                    │
          └─────────────────┼────────────────────┘
                            │
┌──────────────────────────┴───────────────────────────────────┐
│                     Service Layer                             │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│   AI Providers│  Agent Bridge│  Wallet Svc  │  Auth0 Identity │
│ (Venice/     │ (Python      │ (WDK +      │ (Token Vault)   │
│  Gemini/OpenAI)│ FastAPI)    │  OWS)       │                 │
└──────────────┴──────────────┴──────────────┴─────────────────┘
                            │
┌──────────────────────────┴───────────────────────────────────┐
│                    Infrastructure Layer                       │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│   Hetzner    │   Netlify    │   Auth0      │   Blockchains   │
│ (Agent home, │  (Presentation)│ (Identity) │  (Celo/Base)    │
│  ADR 0001)   │              │              │                 │
├──────────────┼──────────────┼──────────────┼─────────────────┤
│   Neon       │   Cloudflare │   Upstash    │   Lighthouse    │
│  (Postgres,  │   R2 + Images│   Redis      │   IPFS/Filecoin │
│   ADR 0003)  │   (Bytes)    │   (Cache)    │  (Verifiable)   │
└──────────────┴──────────────┴──────────────┴─────────────────┘
```

## Monorepo Structure

| Package                     | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `apps/web`                  | Next.js application — UI, API routes, agent loop |
| `apps/chrome-extension`     | Chrome Built-in AI fashion assistant             |
| `packages/shared-types`     | TypeScript types (fashion data, categories)      |
| `packages/shared-ui`        | Reusable UI components                           |
| `packages/ai-client`        | AI provider abstraction layer + React hooks      |
| `packages/agent-web-bridge` | Python FastAPI browser automation service        |
| `packages/db`               | Drizzle schema + migrations for Neon (ADR 0003)  |
| `packages/storage`          | Cloudflare R2 helpers (put, signed URLs, transforms) |
| `packages/messaging-bridge` | Spectrum-ts wrapper — WhatsApp / Telegram / iMessage providers for the Hetzner agent |
| `apps/api/routes/curator-apply.js` | Public curator onboarding endpoint |
| `apps/api/routes/curator-storefront.js` | Public curator storefront read endpoint |
| `apps/api/lib/whatsapp-ingest.js` | WhatsApp media -> R2 -> Neon ingest pipeline |
| `apps/web/app/s/[slug]/page.tsx` | Branded curator storefront UI |
| `apps/web/components/AICuratorSection.tsx` | AI Curator second opinion voices on human storefronts |
| `apps/web/components/CrossCuratorRecommendations.tsx` | Cross-curator product recommendations with attribution tracking |
| `apps/web/app/curator/onboard/page.tsx` | Self-serve Curator onboarding form |
| `apps/web/app/lab/page.tsx` | Agent/web3 surface (TacticalDashboard) relocated here |
| `apps/web/app/admin/analytics/CuratorComparisonTable.tsx` | Cross-curator comparison table with sparklines |
| `apps/web/components/admin/TrendSparkline.tsx` | Shared sparkline, Bar, CSV export, SMA trend components |

## Data Flow

### Consumer dashboard (`/`)
1. **User uploads image/camera** → Client validation
2. **AI processing** → Provider abstraction routes to Venice/Gemini/OpenAI
3. **Style scoring** → Sentiment-weighted analysis (1-10 scale)
4. **Suggestion generation** → AgentSuggestionToast displays proposals
5. **User action** → Accept/reject flows through API
6. **State persistence** → Redis storage with in-memory fallback
7. **Web discovery** (if no catalog match) → Python bridge browses external sites

### Curator storefront (`/s/[slug]`) — Phase 11
1. **Curator + listings loaded** → Hetzner API reads from Neon (`curators` + `listings` joined to `kit_skus`); R2 image URLs constructed via `packages/storage`
2. **Customer lands on branded page** → Curator's logo (if set), colors, voice, inventory scoped
3. **Try-on against Curator catalog** → reuses `VirtualTryOn`, no global product load
4. **Polaroid + share asset** → `PolaroidGallery` + `SessionEndingCard` render with Curator's `brand.frameTemplate`; output persisted to R2 under `/curators/{slug}/polaroids/`
5. **(Optional) AI second opinion** → AI Curator persona renders alongside, recommendations scoped to host Curator's catalog
6. **Buy** → off-ramp via `commerce.checkout`. For `whatsapp`: `wa.me/{phone}?text={prefilled SKU}` deep link. For `shopify`/`stripe`: external checkout URL. For AI-initiated purchases across Curators, the agent layer (autonomous executor + Lighthouse receipts) records attribution + revshare.
7. **Current implementation** → `/s/[slug]` is live in the web app and consumes `GET /api/curator/:slug/storefront`; the first production slice is WhatsApp-first checkout for live listings.

### Curator chat-ops admin (Wanja path) — Phase 11
1. **Curator texts agent** → Spectrum-ts WhatsApp provider → Hetzner `apps/api/routes/agent-whatsapp.js` + `apps/api/lib/whatsapp-ingest.js` (PM2)
2. **Command parsed** → e.g. `+ arsenal home M 2500 4` resolves to `kit_skus.id = arsenal-2425-home`
3. **Media ingest (if photo attached)** → download from Meta API → upload to R2 (`/curators/{slug}/listings/{id}/{n}.jpg`) **within webhook window** (Meta URLs expire ~30 days)
4. **Persist** → insert/update Neon `listings` row; R2 keys (not URLs) stored
5. **Agent reply** → confirmation with `/s/{slug}/{listing-id}` short URL to share with her customer
6. **Customer storefront reflects change immediately** → Hetzner API serves fresh reads; Vercel/Netlify never writes

## Agent Loop Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    PERCEIVE → REASON → ACT                    │
│                                                              │
│  📷 Camera     →  🧠 AI Provider    →  💡 Suggestion Toast  │
│  (live video)     (vision analysis)    (auto-approve < $5)   │
│       ↓                ↓                      ↓              │
│  Style Memory  ←  Track prefs    →   ⚡ Autonomous Exec    │
│  (personalize)    (categories)        (sign + broadcast)     │
│                                          ↓                   │
│                                    🛒 Cart + Checkout        │
│                                    (onchain payment)         │
│                                          ↓                   │
│                                    � Verifiable Receipt     │
│                                    (IPFS + Celo memo tx)     │
│       ↓                ↓                      ↓              │
│  🌐 Web Bridge ←  No Match Found  ←  🔐 Agent Wallet        │
│  (Browser Use)    (Market Search)     (multi-chain)          │
└──────────────────────────────────────────────────────────────┘
```

## Reusable Middleware Modules

These modules live in `apps/web/lib/` and are designed to be extracted into any agent project:

| Module                      | File                                        | Purpose                                                  |
| --------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **Curator Schema**          | `packages/shared-types/curator.ts`          | Single primitive for human merchants + AI personas (ADR 0002) |
| **Curator Loader**          | `apps/web/config/curators/*.json` + `lib/utils/persona-config.ts` | Source of truth for `type: "human"` and `type: "ai"` Curators |
| **Storefront Route**        | `apps/web/app/s/[slug]/page.tsx`            | Composes shipped components against one Curator         |
| **Agent Controls**          | `middleware/agent-controls.ts`            | Spending limits, autonomy thresholds, approval workflows |
| **Autonomous Executor**     | `services/autonomous-executor.ts`          | Signs and broadcasts accepted suggestions onchain      |
| **State Persistence**       | `middleware/agent-store.ts`                 | Redis-backed storage with write-through cache            |
| **Commission Splits**       | `utils/commissions.ts`                      | Four-tier revenue distribution calculator                |
| **Suggestion Toast**        | `components/Agent/AgentSuggestionToast.tsx` | Time-bounded agent-to-user proposals                     |
| **Style Memory**            | `fashion-data.ts` (getRecommendedItems)     | Preference tracking + personalized scoring               |
| **Agent Wallet**            | `services/agent-wallet.ts`                  | Multi-chain self-custodial wallet service (WDK + OWS)  |
| **Self Protocol**           | `services/self-protocol.ts`                 | Self Agent ID registration and verification            |
| **Heartbeat Loop**          | `api/agent/heartbeat/route.ts`            | Proactive gas monitoring, fraud checks, receipt logging  |
| **Agent Dashboard**         | `api/agent/dashboard/route.ts`            | Public transparency endpoint for judges                  |

## AI Provider Abstraction

All AI providers implement a unified interface:

```typescript
interface AIProvider {
  name: string;
  analyzeOutfit(input): Promise<CritiqueResponse>;
  generateDesign(prompt): Promise<DesignGeneration>;
  connectLiveSession?(): Promise<LiveSession>; // streaming providers
}
```

| Provider         | Tier     | Capabilities                                   |
| ---------------- | -------- | ---------------------------------------------- |
| Venice AI        | Free     | Vision analysis via polling (`mistral-31-24b`) |
| Gemini Live      | Premium  | Real-time WebSocket audio + video streaming    |
| OpenAI/Replicate | Fallback | Static analysis, design generation             |

## Agent Web-Agency (Python Bridge)

When the internal catalog lacks a match, the agent uses a 4-tier discovery engine:

- **Tier 1**: Internal catalog (instant, curated)
- **Tier 2**: Purch API aggregation (1B+ products via headless commerce)
- **Tier 2.5**: TinyFish + Bright Data SERP (parallel, structured web search)
- **Tier 3**: Browser Use Cloud (autonomous deep-web browsing)

The bridge is an isolated Python FastAPI service using Browser Use Cloud V3 with structured data extraction via Pydantic models.

## Blockchain Integration

| Network  | Use                                               |
| -------- | ------------------------------------------------- |
| Celo     | Primary — low fees, cUSD stablecoin, mobile-first |
| Base     | Secondary — Coinbase ecosystem                    |
| Ethereum | Multi-chain support                               |
| Polygon  | Multi-chain support                               |

**Smart contracts**: NFT minting (ERC-721A), commission splits (0xSplits), agent tipping (cUSD/USDT transfers).

## Security Model

- **Autonomy threshold**: Actions under $5 cUSD auto-execute via `autonomous-executor.ts`; above requires user approval
- **Autonomous execution flow**: Accepted suggestion → `executeSuggestion()` → agent wallet signs → onchain broadcast → verifiable receipt
- **Policy-gated signing**: OWS layer enforces spend limits before any transaction
- **Fraud detection**: Dead Man's Switch heartbeat, velocity checks, anomaly scoring, multi-sig for >$500
- **Verifiable logs**: Every autonomous action signed by agent wallet, stored on IPFS/Filecoin, with optional Celo memo tx
- **Self Protocol identity**: Agent registered with Self Agent ID for Proof of Humanity compliance
- **Zero data retention**: Venice AI provider doesn't store user data
- **Auth0 Token Vault**: Secure credential delegation for AI agent shopping actions
