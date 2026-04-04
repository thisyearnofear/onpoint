# Getting Started

## Prerequisites

- **Node.js 20+** (use `nvm use` if `.nvmrc` is present)
- **pnpm** — `corepack enable` or `npm i -g pnpm`
- **Python 3.10+** (for the agent web-bridge microservice)

## Quick Start

```bash
git clone https://github.com/thisyearnofear/onpoint.git
cd onpoint
pnpm install
cp .env.example .env.local
pnpm dev
# → Web app: http://localhost:3000
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

### Required

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Static AI routes (fallback) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Wallet connection (RainbowKit) |

### AI Providers

| Variable | Purpose |
|----------|---------|
| `VENICE_API_KEY` | Free-tier vision analysis |
| `VERTEX_API_KEY` | Gemini Live sessions (Google Cloud) |

### Agent Infrastructure

| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Agent state persistence (optional — works without) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `LIGHTHOUSE_API_KEY` | IPFS/Filecoin decentralized storage |
| `AGENT_PRIVATE_KEY` | Agent wallet for demo transactions |

### Social & Integrations

| Variable | Purpose |
|----------|---------|
| `NEYNAR_API_KEY` | Farcaster mini-app integration |

## Project Structure

```
onpoint/
├── apps/
│   ├── web/                  # Next.js web application
│   └── chrome-extension/     # Chrome extension (Built-in AI Challenge)
├── packages/
│   ├── shared-types/         # TypeScript type definitions
│   ├── shared-ui/            # Shared UI components
│   ├── ai-client/            # AI provider abstractions
│   ├── agent-web-bridge/     # Python FastAPI browser automation
│   └── eslint-config/        # Internal linting config
├── deploy/                   # Hetzner VPS deployment scripts
├── openclaw/                 # Agent persona configuration
└── docs/                     # Documentation
```

## Development Commands

```bash
pnpm dev          # Start all apps in development mode
pnpm build        # Build all packages and apps
pnpm lint         # Run ESLint across the monorepo
pnpm check-types  # TypeScript type checking
pnpm format       # Prettier formatting
```

## Deployment

### Google Cloud Run (Primary)

The web app deploys as a containerized Next.js standalone build:

```bash
gcloud run deploy onpoint \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars VERTEX_API_KEY=...,GEMINI_API_KEY=...
```

### Vercel (Alternative)

Push to main branch — automatic deployment via GitHub integration.

### Hetzner VPS (Self-Hosted)

See [deploy/README.md](../deploy/README.md) for PM2 + Nginx setup. Saves $35-60/month vs managed hosting.

## Agent Web-Bridge (Python Microservice)

The autonomous browsing component runs separately:

```bash
cd packages/agent-web-bridge
pip install -r requirements.txt
uvicorn main:app --reload
# → API: http://localhost:8000
```

See [packages/agent-web-bridge/README.md](../packages/agent-web-bridge/README.md) for details.
