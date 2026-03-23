# OnPoint - AI Styling Agent with Self-Custodial Wallet

> **An autonomous AI agent that perceives your outfit in real-time, reasons about fit and style, then proposes and executes on-chain actions — all in one seamless loop.**

## 🏆 Hackathon Submissions

### Synthesis (March 2026) — **Active**

> AI agents and humans build and judge side by side. 28+ partners. $100,000+ in bounties.

| Track                                               | Prize    | Status    |
| --------------------------------------------------- | -------- | --------- |
| **Best Agent on Celo**                              | $10,000  | Submitted |
| **Private Agents, Trusted Actions** (Venice)        | 3000 VVV | Submitted |
| **Agents With Receipts — ERC-8004** (Protocol Labs) | $8,004   | Submitted |

**Project:** [synthesis.devfolio.co/projects/onpoint-privacy-preserving-fashion-ai-agent-9681](https://synthesis.devfolio.co/projects/onpoint-privacy-preserving-fashion-ai-agent-9681)
**ERC-8004 Agent:** #35962 on Base
**Details:** [SYNTHESIS.md](./SYNTHESIS.md)

---

### Tether Hackathon Galactica - WDK Edition 1

### Track: **Agent Wallets (WDK/Openclaw Integration)**

---

## Problem Statement

Fashion shoppers struggle with:

- Decision paralysis when buying clothes online
- No real-time styling feedback
- Expensive personal stylists ($150-500/hour)
- No way to capture and monetize style moments

## Solution: Autonomous AI Styling Agent

OnPoint is a **goal-aware, multimodal AI agent** with a complete perceive → reason → decide → act loop:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ONPOINT AGENT LOOP                            │
│                                                                 │
│  PERCEIVE        REASON           DECIDE        ACT             │
│  ────────        ──────           ──────        ───             │
│  Gemini Live  →  Style Score  →  Score ≥ 8?  →  Mint NFT       │
│  + Venice AI     (sentiment-      ↓yes      +  Tipping Bot      │
│  (vision)        weighted)    Tip Stylist   +  WDK Agent Wallet │
│                                   ↓no         (cUSD/USDT,       │
│                              Continue coaching  multi-chain)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## WDK Integration (Agent Wallet Track)

### Self-Custodial Agent Wallet

Our AI Stylist uses Tether's WDK to operate as an **autonomous economic agent**:

```typescript
// lib/services/agent-wallet.ts
import WDK from "@tetherto/wdk";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";

// Agent wallet supports multiple chains
const SUPPORTED_CHAINS = {
  celo: { name: "Celo", provider: "https://forno.celo.org" },
  base: { name: "Base", provider: "https://mainnet.base.org" },
  ethereum: { name: "Ethereum", provider: "https://eth.drpc.org" },
};
```

### Agent Capabilities via WDK

| Capability           | Implementation                             | Hackathon Track  |
| -------------------- | ------------------------------------------ | ---------------- |
| **Receive Tips**     | Users tip agent in cUSD/USDT via WDK       | Tipping Bot ✅   |
| **Execute Payments** | Agent charges CELO for premium Gemini Live | Agent Wallets ✅ |
| **Mint NFTs**        | Agent proposes + mints style NFTs          | Agent Wallets ✅ |
| **Multi-Chain**      | Celo, Base, Ethereum, Polygon support      | Agent Wallets ✅ |

### Agent Wallet API Endpoints

```bash
# Get agent wallet info
GET /api/agent/wallet

# Response:
{
  "agent": {
    "name": "OnPoint AI Stylist",
    "capabilities": ["multi_chain_wallet", "receive_tips", "execute_payments", "nft_minting"]
  },
  "wallets": [...],
  "addresses": { "celo": "0x...", "base": "0x..." },
  "supportedChains": ["Celo", "Base", "Ethereum", "Polygon"]
}
```

---

## Dual-Provider AI Architecture

### Venice AI (Free Tier)

- Polling-based analysis (2-5s intervals)
- Vision model: `mistral-31-24b`
- No payment required
- Rate limited (60 req/min)

### Gemini Live (Premium Tier)

- Real-time WebSocket streaming
- Full audio/video input
- 0.5 CELO or BYOK
- Session tokens via WDK payment verification

---

## Key Features

### 1. Real-Time Style Scoring

- Sentiment-weighted scoring (1-10 scale)
- Goal-aware analysis (Event / Daily / Critique)
- Position detection with visual feedback

### 2. Autonomous NFT Minting

- Agent proposes mint when score ≥ 8
- User approves via WDK signature
- 85/10/3/2 commission split (seller/platform/affiliate/agent)
- Stored on Celo blockchain

### 3. Agent Tipping

- Users can tip the AI Stylist in cUSD or USDT
- Agent responds with personalized thank you
- Tipping tracked on-chain via WDK agent wallet

### 4. Multi-Chain Wallet via WDK

- Self-custodial agent wallet
- Supports Celo, Base, Ethereum, Polygon
- Can receive payments and execute transactions

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  Live AR    │    │   WDK       │    │   Farcaster         │  │
│  │  HUD        │◄──►│   Wallet    │◄──►│   Mini App SDK      │  │
│  │  Component  │    │   Service   │    │                     │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│         │                   │                    │               │
│         ▼                   ▼                    ▼               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Next.js API Routes                              ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ /api/ai/live-session  - Venice/Gemini provisioning          ││
│  │ /api/ai/venice-analyze - Backend proxy for Venice AI        ││
│  │ /api/ai/verify-payment - CELO payment verification          ││
│  │ /api/agent/wallet     - WDK Agent Wallet API                ││
│  │ /api/agent/tip        - Tipping endpoint                    ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                   │                    │               │
│         ▼                   ▼                    ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ Venice AI   │    │ Gemini Live │    │  Celo Blockchain    │  │
│  │ Vision API  │    │ WebSocket   │    │  (NFT + Tipping)    │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Hackathon Criteria Alignment

| Criteria                     | OnPoint Score | Evidence                                                        |
| ---------------------------- | ------------- | --------------------------------------------------------------- |
| **Technical Correctness**    | ⭐⭐⭐⭐⭐    | WDK integration, multi-chain wallets, WebSocket streaming       |
| **Agent Autonomy**           | ⭐⭐⭐⭐⭐    | Full perceive→reason→decide→act loop without human intervention |
| **Economic Soundness**       | ⭐⭐⭐⭐      | CELO payments, tipping, NFT splits - all on-chain               |
| **Real-World Applicability** | ⭐⭐⭐⭐⭐    | Fashion is $1.7T industry, 1000+ beta users                     |

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/thisyearnofear/onpoint
cd onpoint && pnpm install

# Set environment variables
cp .env.example .env.local
# Add VENICE_API_KEY, GEMINI_API_KEY, etc.

# Run development
pnpm dev
```

---

## Demo

1. Go to Dashboard → "Live AR Stylist"
2. Select provider: Venice (Free) or Gemini (Premium)
3. Choose session goal (Event/Daily/Critique)
4. Start live video analysis
5. Tip the agent or mint NFT when score ≥ 8

---

## Team

Building the future of autonomous fashion agents on Celo.

**Built with:**

- Tether WDK (Agent Wallet)
- Google Gemini Live (Vision + Audio)
- Venice AI (Free tier vision)
- Celo Blockchain (Low-cost transactions)
- Farcaster Mini Apps (Distribution)
