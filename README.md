# OnPoint — Curator-First Styling + Retail Intelligence

> Stylists hand customers a branded try-on → polaroid → share → buy loop. Each session generates live retail intelligence: product gaps, competitor prices, demand signals, and GTM actions.

[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://beonpoint.netlify.app)
[![Multi-Chain](https://img.shields.io/badge/Chains-Celo%20%7C%20Base%20%7C%20Ethereum%20%7C%20Polygon-22C55E)]()
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Registered-blue)](https://8004scan.io/agents/celo/9177)

---

## What It Does

**For shoppers:** Point your camera at an outfit, get instant AI styling feedback, discover matching products, and shop — all with transparent reasoning and spending controls.

**For curators:** The same flow becomes live-web GTM intelligence. When the catalog lacks a match, OnPoint searches the open web, compares market options, and surfaces product gaps, competitor pricing, and recommended actions.

See [ADR 0002 — Curator Primitive](./docs/adr/0002-curator-primitive.md) for the organizing decision.

## Core Features

| Feature | Description |
|---------|-------------|
| **Live AR Styling** | Real-time video analysis with AI coaching overlays |
| **Smart Recommendations** | Products scored by style fit, price, and quality |
| **Agent Web Discovery** | Autonomous browsing when catalog lacks matches |
| **Retail Intelligence** | Shopper intent → product-gap and pricing signals |
| **Secure Token Vault** | Auth0 OAuth for external APIs (Calendar, Slack, etc.) |
| **Spending Controls** | Configurable autonomy: small actions auto-execute, large ones require approval |
| **Style Memory** | Learns preferences across sessions |

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
| [Getting Started](docs/GETTING_STARTED.md) | Setup, environment, deployment |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow |
| [Features](docs/FEATURES.md) | Detailed feature specs |
| [Roadmap](docs/ROADMAP.md) | Current focus and upcoming work |
| [Guides](docs/guides/) | Integration guides (Auth, MiniPay) |
| [ADRs](docs/adr/) | Architecture decision records |

## Hackathons

- **Web Data UNLOCKED** — Bright Data web intelligence, AI/ML API, Cognee memory, TriggerWare workflows
- **Auth0 Authorized to Act** — Token Vault for secure agent API access
- **OWS Hackathon** — Agentic Storefronts + Spend Governance
- **Tether Galactica WDK** — Agent Wallets
- **Protocol Labs Genesis** — Verifiable Agent Logs
- **Synthesis** — Best Agent on Celo, Private Agents

---

**[Live Demo](https://beonpoint.netlify.app)** | [GitHub](https://github.com/thisyearnofear/onpoint) | MIT License
