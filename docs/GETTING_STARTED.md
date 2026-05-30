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
| `AUTH0_BASE_URL`      | Your app URL (`http://localhost:3000` dev, `https://beonpoint.netlify.app` prod) |
| `APP_BASE_URL`        | Same as AUTH0_BASE_URL (legacy compatibility)                                    |
| `AUTH0_MANAGEMENT_API_TOKEN` | Optional - for revoking connections (create M2M app with `read:users`, `update:users`) |

#### Auth0 Tenant Setup

1. **Create Auth0 Account** at https://auth0.com
2. **Create Regular Web Application**:
   - Go to Applications → Create Application
   - Choose "Regular Web Applications"
   - Name it "OnPoint AI Agent"
3. **Configure Application Settings**:
   - Allowed Callback URLs: `http://localhost:3000/auth/callback`, `https://yourdomain.com/auth/callback`
   - Allowed Logout URLs: `http://localhost:3000`, `https://yourdomain.com`
   - Allowed Web Origins: `http://localhost:3000`, `https://yourdomain.com`
4. **Enable Social Connections** (Authentication → Social):
   - ✅ Google OAuth2 (for Calendar integration) — Add scopes: `https://www.googleapis.com/auth/calendar.events`
     - Do not add `https://www.googleapis.com/auth/gmail.readonly` unless Gmail ingestion is implemented and the Google OAuth app has completed restricted-scope verification.
     - If the Google OAuth consent screen is in Testing mode, add each developer/test Gmail address under Google Cloud Console → APIs & Services → OAuth consent screen → Test users.
   - ✅ GitHub (for config storage) — Add scopes: `repo`, `gist`
   - ✅ Slack (for sharing) — Add scopes: `chat:write`, `channels:read`
   - ✅ Microsoft (for Outlook/OneDrive) — Add scopes: `Calendars.ReadWrite`, `Files.Read`
   - For each connection, enable it for your application
5. **Optional: Management API** (for connection revocation):
   - Go to Applications → APIs → Auth0 Management API
   - Create Machine-to-Machine Application
   - Grant permissions: `read:users`, `update:users`, `delete:user_identities`
   - Copy the token to `AUTH0_MANAGEMENT_API_TOKEN`

**Note**: Auth0 SDK v4 uses `/auth/*` routes (not `/api/auth/*`). The middleware in `apps/web/middleware.ts` handles all authentication automatically.

### Wallet Identity

OnPoint uses Auth0 for account identity and wallet connection only where onchain trust is needed.

- MiniPay: the app detects `window.ethereum.isMiniPay` and auto-connects the injected wallet.
- Web/mobile browsers: RainbowKit/WalletConnect handles explicit wallet connection.
- Wallet linking: a connected wallet is not trusted just because an address is present. The user must click "Link Account" and sign a SIWE message; `/api/auth/link-wallet` verifies the signature, domain, and one-time nonce before mapping the wallet to the Auth0 user.
- Wallet-required moments: checkout with crypto, minting, tips, escrow, agent treasury, token-gated access, and signed agent spending permissions.

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

### Vercel or Netlify (Frontend)

The Next.js app can deploy via your preferred frontend host:

1. Connect repository in your frontend host dashboard
2. Set build command: `pnpm build`
3. Set output directory: `apps/web/.next`
4. Configure environment variables in the host UI:
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

### Frontend Caveat

The frontend expects `NEXT_PUBLIC_AGENT_API_URL` to point at the Hetzner API when curator storefronts, agent routes, or AI proxy calls need live backend data.

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
