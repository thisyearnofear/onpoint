# Architecture

## System Overview

OnPoint is a monorepo containing a Next.js web app, AI provider abstractions, and a Python microservice for autonomous web browsing.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
├─────────────────┬──────────────────┬────────────────────────┤
│   Web App       │   Chrome Ext     │   Farcaster Mini App   │
│  (Next.js 15)   │  (Built-in AI)   │   (SDK Widget)         │
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
│   Netlify    │   Auth0      │   Blockchains│   IPFS/Filecoin │
│   (Hosting)  │  (Identity)  │  (Celo/Base) │   (Lighthouse)  │
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

## Data Flow

1. **User uploads image/camera** → Client validation
2. **AI processing** → Provider abstraction routes to Venice/Gemini/OpenAI
3. **Style scoring** → Sentiment-weighted analysis (1-10 scale)
4. **Suggestion generation** → AgentSuggestionToast displays proposals
5. **User action** → Accept/reject flows through API
6. **State persistence** → Redis storage with in-memory fallback
7. **Web discovery** (if no catalog match) → Python bridge browses external sites

## Agent Loop Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    PERCEIVE → REASON → ACT                    │
│                                                              │
│  📷 Camera     →  🧠 AI Provider    →  💡 Suggestion Toast  │
│  (live video)     (vision analysis)    (auto-approve < $5)   │
│       ↓                ↓                      ↓              │
│  Style Memory  ←  Track prefs    →   🛒 Cart + Checkout     │
│  (personalize)    (categories)        (onchain payment)      │
│                                          ↓                   │
│                                    💰 Commission Split       │
│                                    (seller/platform/agent)   │
│       ↓                ↓                      ↓              │
│  🌐 Web Bridge ←  No Match Found  ←  🔐 Agent Wallet        │
│  (Browser Use)    (Market Search)     (multi-chain)          │
└──────────────────────────────────────────────────────────────┘
```

## Reusable Middleware Modules

These modules live in `apps/web/lib/` and are designed to be extracted into any agent project:

| Module                | File                                        | Purpose                                                  |
| --------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **Agent Controls**    | `middleware/agent-controls.ts`              | Spending limits, autonomy thresholds, approval workflows |
| **State Persistence** | `middleware/agent-store.ts`                 | Redis-backed storage with write-through cache            |
| **Commission Splits** | `utils/commissions.ts`                      | Four-tier revenue distribution calculator                |
| **Suggestion Toast**  | `components/Agent/AgentSuggestionToast.tsx` | Time-bounded agent-to-user proposals                     |
| **Style Memory**      | `fashion-data.ts` (getRecommendedItems)     | Preference tracking + personalized scoring               |
| **Agent Wallet**      | `services/agent-wallet.ts`                  | Multi-chain self-custodial wallet service                |

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

When the internal catalog lacks a match, the agent uses a 3-tier discovery engine:

- **Tier 1**: Internal catalog (instant, curated)
- **Tier 2**: Purch API aggregation (1B+ products via headless commerce)
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

- **Autonomy threshold**: Actions under $5 auto-execute; above requires user approval
- **Policy-gated signing**: OWS layer enforces spend limits before any transaction
- **Verifiable logs**: Agent decisions cryptographically signed and stored on IPFS/Filecoin
- **Zero data retention**: Venice AI provider doesn't store user data
- **Auth0 Token Vault**: Secure credential delegation for AI agent shopping actions
