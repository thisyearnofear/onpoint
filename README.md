# OnPoint — AI Styling Agent on Celo

> **An autonomous AI agent that perceives your outfit in real-time, reasons about fit and style, then proposes and executes on-chain actions on Celo — all in one seamless loop.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://onpoint-web-647723858538.us-central1.run.app)
[![Built on Celo](https://img.shields.io/badge/Chain-Celo-35D07F)](https://celo.org)
[![Powered by Gemini Live](https://img.shields.io/badge/AI-Gemini%20Live-blue)](https://ai.google.dev)
[![AG-UI Protocol](https://img.shields.io/badge/Protocol-AG--UI%20v0.1-purple)](https://github.com/ag-ui-protocol/ag-ui)

---

## 🤖 What Does the Agent Actually Do?

OnPoint is not a chatbot wrapped in a UI. It is a **goal-aware, multimodal AI agent** with a full perceive → reason → decide → act loop:

```
┌─────────────────────────────────────────────────────────┐
│                   ONPOINT AGENT LOOP                    │
│                                                         │
│  PERCEIVE        REASON           DECIDE        ACT     │
│  ────────        ──────           ──────        ───     │
│  Gemini Live  →  Style Score  →  Score ≥ 8?  →  Mint   │
│  (vision +       (sentiment-      ↓yes           NFT    │
│   audio)          weighted)    Propose Celo       on    │
│                               NFT + split       Celo   │
│                               ↓no                      │
│                              Continue coaching          │
└─────────────────────────────────────────────────────────┘
```

### Agent Protocol Trace (AG-UI v0.1)

The agent exposes its internal state as a live event stream — viewable in the UI and queryable via REST:

```json
GET /api/ai/agent?goal=event

{
  "sessionId": "agent_lx3q8k",
  "intent": "Event Styling",
  "steps": [
    { "step": 1, "action": "intent_parse",      "status": "done",    "durationMs": 12  },
    { "step": 2, "action": "celo_wallet_check", "status": "done",    "chain": "celo"   },
    { "step": 3, "action": "vision_analysis",   "status": "running", "durationMs": 380 },
    { "step": 4, "action": "style_reasoning",   "status": "running"                    },
    { "step": 5, "action": "score_calculation", "status": "pending"                    },
    { "step": 6, "action": "celo_mint_proposal","status": "pending",  "chain": "celo"  }
  ],
  "meta": { "model": "gemini-2.0-flash-live", "protocol": "AG-UI v0.1" }
}
```

---

## 🏗️ Architecture

```
onpoint/
├── apps/web/
│   ├── app/api/ai/
│   │   ├── agent/          ← Structured AG-UI protocol trace (NEW)
│   │   ├── live-session/   ← Provisions Gemini Live WebSocket + goal system prompts
│   │   ├── virtual-tryon/  ← Static image analysis (Gemini 1.5 Flash)
│   │   ├── style-suggestions/
│   │   └── personality-critique/
│   ├── components/VirtualTryOn/
│   │   ├── LiveStylistView.tsx  ← Core agent UI (goals, capture, score, mint)
│   │   ├── MintLookButton.tsx   ← Celo NFT mint with 85/15 revenue split
│   │   └── CeloTipButton.tsx    ← cUSD tip agent in Celo
│   └── config/
│       └── chains.ts            ← Celo mainnet + Alfajores configured
│
├── packages/
│   ├── ai-client/
│   │   ├── src/use-gemini-live.ts          ← Hook: live session + AG-UI events
│   │   └── src/providers/
│   │       ├── base-provider.ts            ← LiveSession protocol interface
│   │       └── gemini-live-provider.ts     ← Goal-aware simulation + protocol events
│   └── blockchain-client/
│       └── src/                            ← Celo NFT minting + 0xSplits
│
└── README.md
```

---

## 🔑 Agent Features

### 1. Goal-Aware Session Intelligence
The agent adapts its entire reasoning system to one of three goals:

| Goal | System Prompt Strategy | Score Base |
|---|---|---|
| **Event Styling** | Formal/occasion-appropriate focus | 7/10 |
| **Daily Outfit Check** | Fit, coordination, versatility | 7/10 |
| **Honest Critique** | Zero sugarcoating, direct ratings | 5/10 |

### 2. Real-Time Multimodal Perception
- **Gemini Live WebSocket** streams video frames at 1fps for continuous analysis
- **Microphone input** for voice-responsive coaching
- **Position Detection**: frame turns 🟢 green (good distance) or 🟠 orange (too close) based on AI spatial reasoning

### 3. Autonomous Scoring & Mint Proposal
```typescript
// Agent autonomously proposes on-chain action when score threshold met
if (sessionSummary.score >= 8 && isConnected) {
  // Shows "Agent Recommendation" toast → proposes Celo NFT mint
  // Contract: 0xdb65806c994C3f55079a6136a8E0886CbB2B64B1
  // Split: 85% creator, 15% platform (via 0xSplits)
}
```

### 4. AG-UI Protocol Trace
Left panel in the Live Stylist UI shows real-time protocol events:
```
[INTENT]    Initializing Agentic Mesh...
[CELO]      Connecting to Celo Alfajores...
[SECURITY]  Verifying session integrity...
[ACTION]    Ready for on-chain execution.
```

### 5. Proof of Style — On-Chain NFT
- Captures are stored on **Filecoin/IPFS via Lighthouse**
- Metadata (AI critique + style score) minted as NFT on **Celo mainnet**
- **85% royalty** flows to creator via [0xSplits](https://splits.org)
- Shareable to Farcaster with score, topics, and takeaways

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

## 🛠️ Environment Variables

```bash
# AI
VERTEX_API_KEY=          # Gemini Live sessions (required)
GEMINI_API_KEY=          # Fallback for static AI routes

# Storage
LIGHTHOUSE_API_KEY=      # Filecoin/IPFS native storage

# Social
NEYNAR_API_KEY=          # Farcaster social features

# Wallet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Chain RPCs (configured in config/chains.ts)
# Celo: https://forno.celo.org (built-in)
# Alfajores: https://alfajores-forno.celo-testnet.org (built-in)
```

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/ai/agent` | GET/POST | AG-UI protocol trace for current session |
| `/api/ai/live-session` | POST | Provisions Gemini Live WebSocket config |
| `/api/ai/virtual-tryon` | POST | Static image analysis (body, outfit, enhancement) |
| `/api/ai/style-suggestions` | POST | Personalized style recommendations |
| `/api/ai/personality-critique` | POST | AI fashion critic response |
| `/api/ipfs/upload` | POST | Upload to Filecoin via Lighthouse |

## 🔗 On-Chain Contracts

| Network | Contract | Address |
|---|---|---|
| Celo Mainnet | OnPoint NFT | `0xdb65806c994C3f55079a6136a8E0886CbB2B64B1` |
| Celo Alfajores | OnPoint NFT (testnet) | `0xdb65806c994C3f55079a6136a8E0886CbB2B64B1` |
| Celo Mainnet | cUSD | `0x765DE8164458C172EE097029dfb482Ff182ad001` |

## 🏆 Hackathon Targets

- **[Celo: Build Agents for the Real World V2](https://celoplatform.notion.site/Build-Agents-for-the-Real-World-Celo-Hackathon-V2-2fdd5cb803de80c99010c04b6902a3a9)** — Q1 2026
  - Main Track: Best Agent on Celo
  - Infra Track: AG-UI protocol implementation
- **Google Chrome Built-in AI Challenge** — Nov 2025
- **PL Genesis Frontiers of Collaboration** — Filecoin/IPFS storage

## 🔗 Links

- **[Live Demo](https://onpoint-web-647723858538.us-central1.run.app)**
- [GitHub](https://github.com/thisyearnofear/onpoint)

## 📄 License

MIT