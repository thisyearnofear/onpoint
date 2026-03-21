# OnPoint — Agent Infrastructure for Celo

> **Reusable middleware for AI agents with economic agency: spending controls, commission splits, state persistence, and suggestion UX. Proof-of-concept: an autonomous AI stylist that perceives, reasons, shops, and pays on Celo.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://onpoint-web-647723858538.us-central1.run.app)
[![Built on Celo](https://img.shields.io/badge/Chain-Celo-35D07F)](https://celo.org)
[![Track](https://img.shields.io/badge/Track-Infrastructure-purple)](https://celoplatform.notion.site/Build-Agents-for-the-Real-World-Celo-Hackathon-V2-2fdd5cb803de80c99010c04b6902a3a9)
[![Free Tier](https://img.shields.io/badge/Free-Venice%20AI-brightgreen)](https://venice.ai)

---

## The Problem

Every agent that touches money on Celo needs the same things: spending limits, approval workflows, commission splits, state persistence, and UI for user-agent interactions. Today, every team builds these from scratch — or skips them entirely and ships agents with no guardrails.

## What We Built

Five production-ready modules that any agent builder can drop in:

### 1. Agent Controls Middleware (`agent-controls.ts`)

Spending limits, autonomy thresholds, and approval workflows. Any agent that sends cUSD, mints NFTs, or tips other agents needs this.

```typescript
// Validate any agent action against spending limits
const result = AgentControls.validateAction({
  agentId: "onpoint-stylist",
  actionType: "purchase",
  amount: parseEther("3"),
  recipient: "0x...",
});
// result.autoApproved === true (under $5 threshold)
// result.requiresApproval === true (over threshold → creates approval request)
```

- **Autonomy threshold**: actions under configurable amount auto-execute
- **Per-action limits**: daily spend caps per action type
- **Approval workflow**: creates pending requests that users accept/reject via toast UI
- **11 mutation functions** with fire-and-forget Redis persistence

### 2. Commission Split Architecture (`commissions.ts`)

Four-tier revenue distribution for any transaction. Plug-and-play for marketplace agents.

```typescript
const split = calculateSplit(totalWei, sellerAddress, {
  affiliateAddress: "0x...",
  agentAddress: "0x...",
});
// → [{ label: "seller", 85% }, { label: "platform", 10% },
//    { label: "affiliate", 3% }, { label: "agent", 2% }]
```

- Unallocated shares roll to platform (no affiliate → platform gets 13%)
- Commission records persisted to Redis with 90-day TTL
- No dust loss on small amounts (uses platform as remainder recipient)

### 3. State Persistence Layer (`agent-store.ts`)

Redis-backed storage with in-memory fallback. Zero-config: works without Redis, persists when Redis is configured.

| Key Schema              | Content             | TTL            |
| ----------------------- | ------------------- | -------------- |
| `agent:limits:{id}`     | Spending limits     | Permanent      |
| `agent:suggestion:{id}` | Suggestion records  | expiresAt + 1h |
| `agent:approval:{id}`   | Approval requests   | expiresAt + 1h |
| `agent:style:{userId}`  | User preferences    | Permanent      |
| `agent:commission:{id}` | Transaction records | 90 days        |

- Uses Upstash Redis REST API (same pattern as rate-limiting — no SDK dependency)
- BigInt serialization handled (spending limits store wei as strings)
- `initStore()` hydration on first API call per request

### 4. Suggestion Toast System (`AgentSuggestionToast.tsx`)

Time-bounded UI for agent-to-user proposals. Smart gating prevents spam.

- **10-second countdown** with auto-dismiss
- **Auto-approve badge** for sub-threshold actions
- **Smart gating**: 30s cooldown, item-type dedup, 15s session warmup
- Accept/reject flows through to API with status tracking
- `useAgentSuggestions` hook: polls API, manages current suggestion state

### 5. Style Memory + Recommendations (`getRecommendedItems`)

Tracks user interaction preferences and scores product recommendations.

```typescript
// Track interactions
AgentControls.trackStyleInteraction(userId, { category: "shirts", price: 129 });

// Get personalized recommendations
const items = getRecommendedItems(
  {
    categories: ["shirts", "outerwear"],
    priceRange: { min: 50, max: 200 },
  },
  3,
);
// → Scores by: category match (+10), price fit (+5), rating bonus, variety noise
```

---

## Proof of Concept: AI Stylist Agent

The modules above power a complete agent loop:

```
┌──────────────────────────────────────────────────────────────┐
│                    PERCEIVE → REASON → ACT                    │
│                                                              │
│  📷 Camera     →  🧠 Venice/Gemini  →  💡 Suggestion Toast  │
│  (live video)     (AI analysis)        (auto-approve < $5)   │
│       ↓                ↓                      ↓              │
│  Style Memory  ←  Track prefs    →   🛒 Cart + Checkout     │
│  (personalize)    (categories)        (cUSD on Celo)         │
│                                          ↓                   │
│                                    💰 Commission Split       │
│                                    (85/10/3/2 on-chain)      │
└──────────────────────────────────────────────────────────────┘
```

### Live Styling Session

- **Venice AI** (free, 1-min session): polling-based vision analysis at 3s intervals
- **Gemini Live** (paid, 0.5 CELO): real-time WebSocket streaming with audio
- Session timer + capture limits with shareable ending card
- Coaching badges overlay real-time AI observations

### Shopping + Payment

- 13 products across 6 categories with real fashion photography
- Zustand cart store with localStorage persistence
- Checkout API executes cUSD ERC-20 transfers with commission splits
- Agent approval modal for over-threshold transactions

### Social

- Shareable session ending card with style score, insights, and topic badges
- Warpcast integration for Farcaster sharing
- Runs as a Farcaster mini-app

---

## 🏗️ Architecture

```
onpoint/
├── apps/web/
│   ├── app/api/agent/
│   │   ├── suggestion/     ← Suggestion CRUD (create, accept, reject)
│   │   ├── approval/       ← Approval workflow API
│   │   ├── checkout/       ← Cart checkout with commission splits
│   │   ├── mint/           ← NFT minting on Celo
│   │   ├── purchase/       ← Agent-driven purchases
│   │   └── style/          ← Style tracking + recommendations
│   ├── components/
│   │   ├── Agent/
│   │   │   ├── AgentSuggestionToast.tsx    ← Toast UI + useAgentSuggestions hook
│   │   │   ├── AgentApprovalModal.tsx      ← Approval UI + useAgentApproval hook
│   │   │   ├── SuggestionHistoryPanel.tsx  ← Session history
│   │   │   └── AgentStatus.tsx             ← Agent state display
│   │   ├── Shop/
│   │   │   ├── CartDrawer.tsx              ← Slide-out cart
│   │   │   ├── CartButton.tsx              ← Cart icon with badge
│   │   │   └── CheckoutModal.tsx           ← Checkout + payment UI
│   │   └── VirtualTryOn/
│   │       ├── LiveStylistView.tsx         ← Main agent UI (~850 lines)
│   │       ├── SessionEndingCard.tsx       ← Shareable ending card
│   │       └── hooks/useLiveSession.ts     ← Session state hook (695 lines)
│   ├── lib/
│   │   ├── middleware/
│   │   │   ├── agent-controls.ts           ← ⭐ Spending limits, approvals
│   │   │   └── agent-store.ts              ← ⭐ Redis persistence layer
│   │   ├── utils/
│   │   │   ├── commissions.ts              ← ⭐ Revenue split calculator
│   │   │   ├── erc20.ts                    ← cUSD transfer utility
│   │   │   └── logger.ts                   ← Structured logging
│   │   └── stores/
│   │       └── cart-store.ts               ← Zustand cart state
│   └── config/
│       ├── chains.ts                       ← Celo chain config + contracts
│       └── wagmi.ts                        ← Wallet configuration
│
├── packages/
│   ├── shared-types/
│   │   └── src/
│   │       ├── fashion-data.ts             ← Product catalog + getRecommendedItems
│   │       └── fashion-category.ts         ← Category enum
│   └── ai-client/
│       └── src/
│           ├── use-venice-live.ts           ← Venice AI hook (with session timer)
│           ├── use-gemini-live.ts           ← Gemini Live hook
│           └── providers/                   ← AI provider implementations
│
├── agent-economy-plan.md                    ← Architecture vision doc
└── README.md
```

⭐ = Reusable infrastructure module

---

## 🔑 Key Design Decisions

### Autonomy Threshold ($5)

Small actions auto-execute without interrupting the user. Large actions require explicit approval. This creates the right UX: frictionless for trivial decisions, safe for meaningful ones.

### Write-Through Cache Pattern

Maps serve as synchronous read cache. Every mutation persists to Redis fire-and-forget. `initStore()` hydrates on first API call. No blocking on network calls, graceful fallback when Redis is unavailable.

### Commission Roll-Up

Without affiliate/agent refs, their share rolls to platform (not lost to rounding). This means the platform always gets a minimum of 10% + any unallocated shares, ensuring no value leaks.

### Session Gating

30-second cooldown between suggestions, item-type dedup, 15-second warmup. Prevents the AI from spamming the user with toasts during live sessions. The AI is powerful — the UX must constrain it.

---

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/thisyearnofear/onpoint.git
cd onpoint
pnpm install

# Copy env vars
cp .env.example .env.local

# Start development
pnpm dev
# → Web app: http://localhost:3000
```

### Environment Variables

```bash
# AI
VERTEX_API_KEY=          # Gemini Live sessions
GEMINI_API_KEY=          # Fallback for static AI routes

# Agent Persistence (optional — works without Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Storage
LIGHTHOUSE_API_KEY=      # Filecoin/IPFS storage

# Social
NEYNAR_API_KEY=          # Farcaster mini-app

# Wallet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
AGENT_PRIVATE_KEY=       # Agent wallet for cUSD transfers (demo mode if unset)
```

---

## 📡 API Reference

| Endpoint                | Method         | Description                          |
| ----------------------- | -------------- | ------------------------------------ |
| `/api/agent/suggestion` | GET/POST/PATCH | Suggestion CRUD                      |
| `/api/agent/approval`   | GET/POST/PATCH | Approval workflow                    |
| `/api/agent/checkout`   | POST           | Cart checkout with commission splits |
| `/api/agent/mint`       | POST           | NFT minting on Celo                  |
| `/api/agent/purchase`   | POST           | Agent-driven purchases               |
| `/api/agent/style`      | GET/POST       | Style tracking + recommendations     |

---

## 🔗 On-Chain

| Network      | Contract    | Address                                      |
| ------------ | ----------- | -------------------------------------------- |
| Celo Mainnet | OnPoint NFT | `0xdb65806c994C3f55079a6136a8E0886CbB2B64B1` |
| Celo Mainnet | cUSD        | `0x765DE8164458C172EE097029dfb482Ff182ad001` |

---

## 🏆 Hackathon

**[Celo: Build Agents for the Real World V2](https://celoplatform.notion.site/Build-Agents-for-the-Real-World-Celo-Hackathon-V2-2fdd5cb803de80c99010c04b6902a3a9)**

**Track: Infrastructure** — Building foundational middleware that other agent builders on Celo can use.

The agent-controls middleware, commission splits, state persistence, suggestion UX, and style memory system are designed as drop-in modules. The AI stylist agent is the proof-of-concept that validates them working together.

---

## 🔗 Links

- **[Live Demo](https://onpoint-web-647723858538.us-central1.run.app)**
- [GitHub](https://github.com/thisyearnofear/onpoint)

## 📄 License

MIT
