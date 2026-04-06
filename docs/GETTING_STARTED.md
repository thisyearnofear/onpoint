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

| Variable                               | Purpose                        |
| -------------------------------------- | ------------------------------ |
| `GEMINI_API_KEY`                       | Static AI routes (fallback)    |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Wallet connection (RainbowKit) |

### AI Providers

| Variable         | Purpose                             |
| ---------------- | ----------------------------------- |
| `VENICE_API_KEY` | Free-tier vision analysis           |
| `VERTEX_API_KEY` | Gemini Live sessions (Google Cloud) |

### Agent Infrastructure

| Variable                   | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `UPSTASH_REDIS_REST_URL`   | Agent state persistence (optional — works without) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token                                   |
| `LIGHTHOUSE_API_KEY`       | IPFS/Filecoin decentralized storage                |
| `AGENT_PRIVATE_KEY`        | Agent wallet for demo transactions                 |

### Social & Integrations

| Variable         | Purpose                        |
| ---------------- | ------------------------------ |
| `NEYNAR_API_KEY` | Farcaster mini-app integration |

### Auth0 (Token Vault for AI Agents)

| Variable              | Purpose                                                                          |
| --------------------- | -------------------------------------------------------------------------------- |
| `AUTH0_DOMAIN`        | Your Auth0 tenant (e.g., `dev-xxx.uk.auth0.com`)                                 |
| `AUTH0_CLIENT_ID`     | Application client ID from Auth0 dashboard                                       |
| `AUTH0_CLIENT_SECRET` | Application client secret (server-only)                                          |
| `AUTH0_SECRET`        | 64-char secret for session encryption (`openssl rand -hex 32`)                   |
| `APP_BASE_URL`        | Your app URL (`http://localhost:3000` dev, `https://beonpoint.netlify.app` prod) |

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

### Netlify (Primary)

The web app deploys automatically via GitHub integration:

1. Connect repository in Netlify dashboard
2. Set build command: `pnpm build`
3. Set publish directory: `apps/web/.next`
4. Configure environment variables in Netlify UI:
   - `AUTH0_DOMAIN` (public)
   - `AUTH0_CLIENT_ID` (public)
   - `APP_BASE_URL` (public)
   - `AUTH0_CLIENT_SECRET` (server-only - mark as secret)
   - `AUTH0_SECRET` (server-only - mark as secret)

### Google Cloud Run (Alternative)

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
