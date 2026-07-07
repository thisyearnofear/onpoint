# OnPoint — AI-Powered Fashion Platform

> **Your WhatsApp. Your Storefront. AI-Powered.**

OnPoint is a multi-sided fashion platform serving three distinct customers:

1. **Curators** (PRIMARY) — WhatsApp-first fashion sellers who need branded storefronts, M-Pesa payments, and AI assistance
2. **Consumers** — Style seekers who want AR try-on, AI coaching, and personalized recommendations  
3. **AI Agents** — Autonomous shopping agents with spending controls and verifiable commerce

[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://beonpoint.netlify.app)
[![Multi-Chain](https://img.shields.io/badge/Chains-Celo%20%7C%20Base%20%7C%20Ethereum%20%7C%20Polygon-22C55E)]()
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Registered-blue)](https://8004scan.io/agents/celo/9177)

---

## 📋 Strategic Direction

**Current Phase**: Curator Activation (Q3 2026) — 9 human curators + 1 digital curator (Nia Digital) live

We're building the obvious choice for WhatsApp-first fashion sellers in Africa. The product is curator-focused first, then expands to multi-role homepage once each segment proves traction.

**Key Document**: [`docs/STRATEGY.md`](./docs/STRATEGY.md) — Phased roadmap, success criteria, decision framework, what's built

**Success Metrics** (Phase 1 Exit Criteria):
- ✅ 10 active curators (currently 3 ready)
- ✅ 40% activation rate (onboard → first sale within 7 days)
- ✅ 60% week-1 retention
- ✅ NPS > 50

---

## What It Does

### For Curators (Small Business Sellers)
- **Branded Storefront**: Get your own URL at `/s/[your-name]` in 30 seconds
- **M-Pesa Integration**: Automated payment requests via Safaricom Daraja API
- **WhatsApp Receipts**: Automated order confirmations sent via WhatsApp Business API
- **Product Management**: Upload from phone camera, manage inventory, track stock
- **Order & Customer Management**: See orders, mark shipped, track repeat customers
- **AI Try-On**: Your customers can virtually try products before buying
- **Digital Discovery**: AI digital curators (like Nia Digital) create designs that route traffic to your physical inventory via tag-matched similar items
- **Marketing Automation**: One-tap broadcasts to customer base

### For Consumers (Style Seekers)
- **Live AR Styling**: Real-time camera analysis with AI coaching overlays
- **AI Personas**: Get feedback from multiple AI stylists (free & premium)
- **Virtual Try-On**: See yourself in clothes before purchasing
- **Smart Recommendations**: Products scored by style fit, price, and quality
- **Shop Curator Storefronts**: Browse products from vetted sellers

### For AI Agents (Autonomous Commerce)
- **Agent Wallet**: Self-custodial wallet with configurable spending limits
- **x402 Try-On Payments**: Pay $0.25 cUSD per try-on via HTTP 402 challenge flow
- **Digital Curators**: Try on AI-generated designs from digital curators like Nia Digital, then get matched to similar physical items from human curators
- **Spending Controls**: Auto-execute small purchases, request approval for large ones
- **Verifiable Actions**: Cryptographic signing + IPFS audit trails
- **Web Discovery**: Autonomous browsing when catalog lacks matches
- **Fraud Detection**: Circuit breakers, anomaly detection, escrow protection

**Architecture**: See [ADR 0002 — Curator Primitive](./docs/adr/0002-curator-primitive.md) for the organizing decision.

## Core Features

| Feature | Description |
|---------|-------------|
| **Live AR Styling** | Real-time video analysis with AI coaching overlays |
| **Smart Recommendations** | Products scored by style fit, price, and quality |
| **Agent Web Discovery** | Autonomous browsing when catalog lacks matches |
| **Proactive Market Monitoring** | Worker polls trending fashion hourly, matches against your style preferences, surfaces discoveries in the wallet panel |
| **Retail Intelligence** | Shopper intent → product-gap and pricing signals |
| **Secure Token Vault** | Auth0 OAuth for external APIs (Calendar, Slack, etc.) |
| **Spending Controls** | Configurable autonomy: small actions auto-execute, large ones require approval |
| **Style Memory** | Learns preferences across sessions |
| **Autonomous Agent Worker** | Persistent background task loop: heartbeat, suggestion processing, market signal polling via PM2 |
| **Autonomous Commerce Loop** | Worker tracks price history per item, detects drops ≥10%, checks user budget & autonomy threshold, auto-buys or surfaces hot deal suggestions |
| **Style Guides & Content** | 5 original fashion buying guides at `/guides` covering football kits, Ankara prints, streetwear, vintage, and formal wear — drives SEO and affiliate monetization |
| **About Page** | `/about` with mission, story, and team identity — meets publisher transparency requirements for affiliate networks |
| **Interactive LookCrafter** | Zero-signup lead magnet: pick occasion + vibe + persona, get a shareable polaroid result card — drives viral loops |
| **Referral & Score Tracking** | Trackable share links, score progression hook, product notifications (milestones, streaks), monthly style recap email |

## How It Works

```
Camera → AI Analysis → Style Suggestions → Shop & Learn
(live)   (vision)      (reasoning)         (catalog + web)
```

1. **Perceive**: Live video or photo upload
2. **Reason**: Vision AI analyzes outfit, body type, style goals
3. **Act**: Surface curated picks from catalog + web search
4. **Learn**: Update style memory for next session

## Agent Identity

| Identifier | Value |
|------------|-------|
| **ERC-8004 Agent ID** | [9177](https://8004scan.io/agents/celo/9177) |
| **Agent Wallet (Celo)** | [`0x5b33E63440e95289207120B94da78CE22F9D24fB`](https://celoscan.io/address/0x5b33E63440e95289207120B94da78CE22F9D24fB) |
| **Identity Registry** | [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| **NFT Contract** | [`0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576`](https://celoscan.io/address/0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576) |

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

### Key Environment Variables

```bash
# Auth0 (Token Vault)
AUTH0_SECRET=<your-secret>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<your-tenant>.auth0.com
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>

# AI Providers
VENICE_API_KEY=<your-key>
GEMINI_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>

# Production API
NEXT_PUBLIC_AGENT_API_URL=https://api.onpoint.famile.xyz
AGENT_API_URL=https://api.onpoint.famile.xyz
SERVICE_API_KEY=<match-hetzner-service-key>

# Optional integrations
BRIGHTDATA_API_KEY=<your-key>
UPSTASH_REDIS_REST_URL=<your-url>
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

See [Getting Started](docs/GETTING_STARTED.md) for full setup.

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Zustand
- **AI**: Venice AI, Google Gemini Live, OpenAI, AI/ML API
- **Auth**: Auth0 Token Vault (RFC 8693 Token Exchange)
- **Blockchain**: Celo, Base, Ethereum, Polygon (RainbowKit)
- **Storage**: IPFS/Filecoin (Lighthouse), Redis (Upstash)
- **Agent Bridge**: Python FastAPI + Browser Use Cloud + Bright Data
- **Deployment**: Hetzner VPS (API), Netlify (Frontend)

## Architecture

**Monorepo structure:**
- `apps/web` — Next.js frontend (Netlify)
- `apps/api` — Express API (Hetzner VPS)
- `apps/bridge` — Python FastAPI agent bridge (Hetzner)
- `packages/` — Shared utilities and types

**Key patterns:**
- Next.js rewrites proxy public routes to Hetzner
- Service-key auth for protected API routes
- Canvas-based image processing for thumbnails
- Skimlinks auto-wraps affiliate commerce links

## Documentation

| Doc | What's Inside |
|-----|--------------|
| [Strategy](docs/STRATEGY.md) | Phased roadmap, what's built, success metrics, decision framework |
| [Getting Started](docs/GETTING_STARTED.md) | Setup, environment, deployment |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, digital→physical funnel |
| [Features](docs/FEATURES.md) | Feature specs (curator storefronts, digital curators, agent commerce) |
| [Monitoring](docs/MONITORING.md) | Hetzner monitoring stack, dashboards, alerting |
| [Guides](docs/guides/) | Integration guides (Auth, WhatsApp, MiniPay) |
| [ADRs](docs/adr/) | Architecture decision records (0001–0011) |

## Agent Worker

The `onpoint-worker` (PM2 process, port 48754) is the agent's persistent brain:

| Cycle | Interval | What it does |
|---|---|---|
| **Heartbeat** | 5 min | Checks wallet gas, Redis, bridge health; reports to Sentry |
| **Task processing** | 5 min | Processes pending `external_search` suggestions via the web bridge |
| **Market signal polling** | 15 min | Fetches trending fashion from Bright Data / TinyFish, stores in Redis, runs style matching against active users' preferences, creates agent suggestions for matches. **Also runs the commerce pipeline:** price history update, drop detection, and auto-buy for matched items |

Users see discoveries in the **AgentStatus** wallet panel as a "Agent Discoveries" card showing matched items with name, price, source, and match reasons.

### Tier 3: Autonomous Commerce Loop

The worker also runs a **commerce pipeline** after each market signal cycle:

| Step | What it does |
|---|---|
| **Price tracking** | Maintains a Redis Hash (`market:prices:v2`) recording price, `firstSeen`, `lastSeen`, and `seenCount` per item keyed by `name\|source\|url` |
| **Drop detection** | Compares new signal prices against stored history. Flags drops ≥10% (configurable via `PRICE_DROP_THRESHOLD`) |
| **Drop storage** | Saves drops to a global capped list (500 items, 7d TTL) and per-user lists (50 items, 7d TTL) in Redis |
| **Auto-buy** | For each active user: scores the dropped item against style preferences, checks spending limits and autonomy threshold, creates an `external_purchase` suggestion. Items under the threshold auto-execute and record a verifiable receipt |

**API endpoints:**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/agent/tasks/market-signals` | Now returns `dropsFound`, `drops`, and `autoBuyResults` in the response |
| `POST` | `/api/agent/tasks/auto-buy` | Trigger an autonomous purchase for a specific user + price drop item |
| `GET`  | `/api/agent/tasks/drops?userId=X` | Fetch price drops for a user (or global drops without `userId`) |

**UI:** A "Hot Deals" card in the AgentStatus wallet panel shows price drops with item image, name, new price, strikethrough old price, and a `↓X%` badge. The worker logs drops found, auto-buy attempts, and auto-buy executions to the health endpoint.

## Integrations

- **Etherfuse FX API** — Fiat onramp for the agent wallet. Users buy USDC with MXN/USD/EUR via SPEI (Bitso-compatible), OXXO, or wire. The [`@repo/etherfuse`](packages/etherfuse) package is the single source of truth for the HTTP client, quote/order helpers, webhook verification, and credit ledger. **Backend-ready** — routes, Redis persistence, and spend-policy integration are active. The UI (`AddFundsButton` + balance card) has been removed pending API key availability. To activate: set `ETHERFUSE_API_KEY` and mount the component.

---

## Testing — TestSprite Verification Loop

This project uses [TestSprite CLI](https://github.com/TestSprite/testsprite-cli) for AI-driven frontend testing against the live deployment at [beonpoint.netlify.app](https://beonpoint.netlify.app).

### Test coverage

5 frontend tests verify the curator journey end-to-end:

| Test | What it verifies |
|------|-----------------|
| Homepage mobile nav | "BeOnPoint" brand + "Curators" link visible |
| Curator landing page | "WhatsApp is your checkout" hero, before/after comparison, CTAs |
| Storefront (Wanja) | Listings, "Try with AI" buttons, M-Pesa, "Browse all curators" |
| Intel dashboard | "Data you lose on WhatsApp" banner, funnel, "OnPoint only" badge |
| Onboarding form | "Start your OnPoint storefront", slug/name fields, "Create storefront" button |

### Running tests

```bash
# Install TestSprite CLI
npm install -g @testsprite/testsprite-cli

# Authenticate
testsprite setup

# Run all tests
testsprite test rerun <test-id-1> <test-id-2> ... --wait --output json

# Read failure bundle
testsprite test failure get <test-id> --out .testsprite/failure
```

### CI/CD

Tests are wired into GitHub Actions — see [`.github/workflows/testsprite.yml`](.github/workflows/testsprite.yml). Every PR triggers a full test rerun against the live site.

### Loop history

See [`LOOP.md`](./LOOP.md) for the agent-written log of each verification iteration.

---

**[Live Demo](https://beonpoint.netlify.app)** | [GitHub](https://github.com/thisyearnofear/onpoint) | MIT License
