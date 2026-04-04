# OnPoint — AI-Powered Personal Styling Agent

> **An autonomous AI agent that sees what you're wearing, understands your style, and helps you shop — with built-in spending controls, transparent decision-making, and self-custodial payments.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://onpoint-web-647723858538.us-central1.run.app)
[![Multi-Chain](https://img.shields.io/badge/Chains-Celo%20%7C%20Base%20%7C%20Ethereum%20%7C%20Polygon-22C55E)]()
[![Open Source](https://img.shields.io/badge/License-MIT-blue)]()

---

## The Problem

Online fashion shoppers face three unsolved problems:

1. **Decision paralysis** — Endless scrolling with no personalized guidance
2. **No real-time feedback** — Can't get a second opinion while trying things on
3. **Opaque AI recommendations** — No visibility into why an AI suggests what it does

Personal stylists solve these but cost $150–500/hour and aren't available on demand.

## What OnPoint Does

OnPoint is an **AI styling agent** you can interact with in real time. Point your camera at an outfit, get instant styling feedback, discover products that match your taste, and shop — all with full transparency into the agent's decisions and spending limits.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Live AR Styling** | Real-time video analysis with AI feedback — like a FaceTime call with a fashion consultant |
| **Smart Recommendations** | Personalized product suggestions scored by style fit, price, and quality |
| **Agent Shopping** | When the internal catalog doesn't have a match, the agent browses the open web for you |
| **Transparent Decisions** | Every suggestion comes with a visible reasoning trail — see exactly why the agent recommends something |
| **Spending Controls** | Configurable autonomy thresholds: small actions auto-execute, large ones require your approval |
| **Style Memory** | Learns your preferences over time across sessions for increasingly personalized advice |

### How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                    PERCEIVE → REASON → ACT                    │
│                                                              │
│  📷 Camera     →  🧠 AI Analysis    →  💡 Style Suggestions │
│  (live video)     (vision + style)     (with reasoning)      │
│       ↓                ↓                      ↓              │
│  Style Memory  ←  Learn prefs    →   🛒 Discover & Shop     │
│  (personalize)    (categories)        (catalog + web)        │
└──────────────────────────────────────────────────────────────┘
```

## Key Features

### Live AR Stylist Session
- **Free tier** — AI vision analysis with adaptive polling (no payment needed)
- **Premium tier** — Real-time voice + video streaming with interruptible conversations
- **Session controls** — Timer, capture limits, shareable ending card with style score
- **Coaching badges** — Real-time AI observations overlaid on your camera feed

### Smart Shopping
- Curated product catalog across 6 categories with real fashion photography
- Personalized scoring: category fit (+10), price range (+5), rating bonus
- Cart with localStorage persistence and one-click checkout
- Commission splits ensure fair revenue distribution across sellers, platform, and agents

### Agent Web Discovery
When the internal catalog lacks a match, the agent autonomously searches the web:
- **3-tier discovery**: Internal catalog → API aggregation → Autonomous browsing
- **Live monitoring**: Watch the agent browse in real time via the UI
- **Whitelist prioritization**: FARFETCH, SSENSE, Zara, ASOS for quality data

### Transparent Agent Decisions
Every agent action is verifiable:
- **Spending limits** — Configurable autonomy threshold ($5 auto, above requires approval)
- **Suggestion toast** — Time-bounded proposals with accept/reject flows
- **Audit trail** — Cryptographically signed decision logs stored on decentralized storage

### Social & Sharing
- Share style sessions and "proof of style" snapshots to social feeds
- Tip the AI stylist for great advice
- Cross-platform identity and reward tracking

---

## For Developers

OnPoint is built as a **monorepo** with reusable middleware that any agent builder can integrate:

- **Agent Controls** — Spending limits, approval workflows, autonomy thresholds
- **Commission Splits** — Four-tier revenue distribution for marketplace transactions
- **State Persistence** — Redis-backed storage with in-memory fallback
- **Suggestion UX** — Time-bounded agent-to-user proposal system
- **Style Memory** — Persistent user preference tracking with recommendations
- **Agent Web-Agency** — Autonomous web browsing microservice

Each module is designed to be dropped into any agent-based application.

---

## Quick Start

```bash
git clone https://github.com/thisyearnofear/onpoint.git
cd onpoint
pnpm install
cp .env.example .env.local
pnpm dev
# → Web app: http://localhost:3000
```

See [Getting Started](docs/GETTING_STARTED.md) for full setup instructions.

---

## Documentation

| Doc | What's Inside |
|-----|--------------|
| [Getting Started](docs/GETTING_STARTED.md) | Setup, environment variables, deployment |
| [Architecture](docs/ARCHITECTURE.md) | System design, monorepo structure, data flow |
| [Features](docs/FEATURES.md) | Detailed feature specifications |
| [Roadmap](docs/ROADMAP.md) | Development progress and future plans |

---

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Zustand
- **AI**: Venice AI, Google Gemini Live, OpenAI GPT-4V
- **Blockchain**: Celo, Base, Ethereum, Polygon (via WDK + RainbowKit)
- **Storage**: IPFS/Filecoin (Lighthouse), Redis (Upstash)
- **Social**: Farcaster, Memory Protocol
- **Agent Bridge**: Python FastAPI + Browser Use Cloud
- **Deployment**: Google Cloud Run, Vercel

---

## Hackathons

OnPoint has been developed across multiple hackathons:

- **OWS Hackathon** — Agentic Storefronts + Spend Governance
- **Tether Galactica WDK** — Agent Wallets
- **Protocol Labs Genesis** — Verifiable Agent Logs
- **Synthesis** — Best Agent on Celo, Private Agents, Agents With Receipts

---

## Links

- **[Live Demo](https://onpoint-web-647723858538.us-central1.run.app)**
- [GitHub](https://github.com/thisyearnofear/onpoint)

## License

MIT
