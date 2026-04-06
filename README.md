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

**Built with Auth0 Token Vault** — Your AI agent securely accesses external services (Google Calendar, Slack, GitHub) on your behalf without ever seeing your credentials. OAuth tokens are stored in Auth0's Token Vault and exchanged on-demand using RFC 8693 Token Exchange.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Live AR Styling** | Real-time video analysis with AI feedback — like a FaceTime call with a fashion consultant |
| **Smart Recommendations** | Personalized product suggestions scored by style fit, price, and quality |
| **Agent Shopping** | When the internal catalog doesn't have a match, the agent browses the open web for you |
| **Secure Token Vault** | Agent accesses external APIs (Calendar, Slack, etc.) via Auth0 Token Vault — no exposed credentials |
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

### Secure Token Vault Integration
Agent accesses external services without exposing credentials:
- **Connected Accounts** — Users authorize access via OAuth (Google, Slack, GitHub, etc.)
- **Token Vault** — Auth0 securely stores and manages provider tokens
- **On-Demand Exchange** — Agent requests scoped tokens only when needed (RFC 8693)
- **User Control** — View connected accounts, revoke access anytime
- **Example Use Cases**:
  - Schedule try-on appointments in Google Calendar
  - Share outfit recommendations to Slack
  - Save style configs to GitHub
  - Create fashion journal entries in Notion

### Social & Sharing
- Share style sessions and "proof of style" snapshots to social feeds
- Tip the AI stylist for great advice
- Cross-platform identity and reward tracking

---

## For Developers

OnPoint is built as a **monorepo** with reusable middleware that any agent builder can integrate:

- **Auth0 Token Vault** — Secure OAuth token management for AI agents (RFC 8693)
- **Agent Controls** — Spending limits, approval workflows, autonomy thresholds
- **Commission Splits** — Four-tier revenue distribution for marketplace transactions
- **State Persistence** — Redis-backed storage with in-memory fallback
- **Suggestion UX** — Time-bounded agent-to-user proposal system
- **Style Memory** — Persistent user preference tracking with recommendations
- **Agent Web-Agency** — Autonomous web browsing microservice

Each module is designed to be dropped into any agent-based application.

### Token Vault Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURE TOKEN FLOW                         │
│                                                              │
│  User          →  OAuth Consent   →  Auth0 Token Vault     │
│  (authorizes)     (Google/Slack)     (stores tokens)        │
│       ↓                                     ↓               │
│  Agent Request →  Token Exchange  →  API Call              │
│  (needs access)   (RFC 8693)         (with delegated token) │
│                                                              │
│  ✓ Agent never sees credentials                             │
│  ✓ Tokens auto-refresh                                      │
│  ✓ User can revoke anytime                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
git clone https://github.com/thisyearnofear/onpoint.git
cd onpoint
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Add your Auth0 credentials to .env.local
pnpm dev
# → Web app: http://localhost:3000
```

### Environment Variables

```bash
# Auth0 for Token Vault
AUTH0_SECRET=<your-secret>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<your-tenant>.auth0.com
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>

# AI Providers
VENICE_API_KEY=<your-key>
GOOGLE_GEMINI_API_KEY=<your-key>

# Redis (optional, falls back to in-memory)
UPSTASH_REDIS_REST_URL=<your-url>
UPSTASH_REDIS_REST_TOKEN=<your-token>
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
- **Auth & Token Vault**: Auth0 for AI Agents (RFC 8693 Token Exchange)
- **Blockchain**: Celo, Base, Ethereum, Polygon (via WDK + RainbowKit)
- **Storage**: IPFS/Filecoin (Lighthouse), Redis (Upstash)
- **Social**: Farcaster, Memory Protocol
- **Agent Bridge**: Python FastAPI + Browser Use Cloud
- **Deployment**: Hetzner VPS (API), Netlify (Frontend)

---

## Hackathons

OnPoint has been developed across multiple hackathons:

- **Auth0 Authorized to Act** — Token Vault for secure agent API access
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
