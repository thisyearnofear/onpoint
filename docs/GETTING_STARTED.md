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

| Variable               | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `VENICE_API_KEY`       | Free-tier vision analysis                        |
| `AZURE_CV_ENDPOINT`    | Azure Computer Vision endpoint                   |
| `AZURE_CV_API_KEY`     | Azure Computer Vision API key (F0 free tier)     |
| `VERTEX_API_KEY`       | Gemini Live sessions (Google Cloud)              |

### API Infrastructure

The Express API uses these server-only variables in `apps/api/.env`:

| Variable | Purpose |
| --- | --- |
| `NEON_DATABASE_URL` | Neon Postgres for curator/storefront, order, and try-on routes |
| `REDIS_URL` | Shared cache, rate limiting, and durable API state; local state fallbacks keep development walkable when unavailable |
| `AGENT_WALLET_ADDRESS` | Explicit agent/platform money destination; required in production-like environments |
| `PLATFORM_WALLET_ADDRESS` | Optional explicit legacy platform-wallet alias; otherwise the agent wallet is used |
| `SERVICE_API_KEY` | Service-to-service auth (`x-service-key` or Bearer). Must equal the web app's `SERVICE_API_KEY`; guards `/api/orders/record` and `/api/status/funnel*` |
| `VISITOR_HASH_SALT` | Salt for the day-scoped visitor hash used by share/visit analytics. Set a unique value in production |

`NEON_DATABASE_URL` is resolved when the DB helper is called, so changing or
removing it takes effect for new connections and tests without restarting the
module cache.

### Agent execution and verifiability

| Variable                   | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `UPSTASH_REDIS_REST_URL`   | Web/agent-core state persistence (optional — works without) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token                                   |
| `LIGHTHOUSE_API_KEY`       | IPFS/Filecoin decentralized storage                |
| `AGENT_PRIVATE_KEY`        | Agent wallet for demo transactions                 |

### Curator payout wallets (optional)

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` | `apps/web/.env.local` / Fly build args | Magic email/Google login for curator payouts (Celo) |
| `MAGIC_SECRET_KEY` | API server only (`apps/api/.env`) | Magic Express/TEE — never expose to web |
| `CURATOR_PAYOUT_KEYS_PATH` | API server only | Custodial bootstrap key file (chmod 600) |

See [curator-payout-wallets.md](./ops/curator-payout-wallets.md).

### M-Pesa checkout (web app, optional)

Set as Fly secrets on `onpoint-web`. Full setup, sandbox test, and go-live checklist: [ops/mpesa-setup.md](./ops/mpesa-setup.md).

| Variable | Purpose |
| --- | --- |
| `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, `DARAJA_PASSKEY`, `DARAJA_BUSINESS_SHORTCODE` | Safaricom Daraja credentials (sandbox shortcode `174379`) |
| `DARAJA_SANDBOX` | Defaults to sandbox; set `false` only after go-live |
| `DARAJA_CALLBACK_BASE_URL` | **Set explicitly** to the web origin. The fallback chain can resolve to the API host, which has no `/api/curator/stk-callback` |
| `DARAJA_CALLBACK_SECRET` | **Set this.** Shared secret in the callback URL (`?s=`), required on every STK callback. Unset means forged callbacks are possible |
| `SERVICE_API_KEY` | Lets the STK callback record confirmed orders in the API ledger |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Payment records live here and the callback matches on them |

### Admin console (web app)

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAILS` | Comma/space-separated list of **verified Auth0 emails** allowed into `/admin` and `/api/admin`. Falls back to `ADMIN_EMAIL`. With neither set those routes return `503`. See [ops/auth.md](./ops/auth.md#admin-access-admin-apiadmin) |

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
| `AUTH0_BASE_URL`      | Your app URL (`http://localhost:3000` dev, `https://onpoint.trustfall.xyz` prod) |
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

- MiniPay: the app detects `window.ethereum.isMiniPay` and can behave wallet-aware from the first session because the wallet is the host environment. The wallet may auto-connect, but account linking still remains explicit.
- Web/mobile browsers: use Auth0 or email/social login first. RainbowKit/WalletConnect should be offered contextually when the user reaches a wallet-required action, not as a blocking login step.
- Desktop/mobile web3 users: WalletConnect is a contextual linking and signing rail for checkout, ownership, rewards, and spend permissions. It is not the default identity primitive for the whole app.
- Wallet linking: a connected wallet is not trusted just because an address is present. The user must click "Link Account" and sign a SIWE message; `/api/auth/link-wallet` verifies the signature, domain, and one-time nonce before mapping the wallet to the Auth0 user.
- Wallet-required moments: checkout with crypto, minting, tips, escrow, agent treasury, token-gated access, and signed agent spending permissions.

## Project Structure

```
onpoint/
├── apps/
│   ├── web/                  # Next.js web application
│   └── api/                  # Express API — storefronts, try-on, orders, x402 (Hetzner)
├── packages/
│   ├── shared-types/         # TypeScript type definitions
│   ├── shared-ui/            # Shared UI components
│   ├── agent-core/           # Typed SDK for the agent commerce API
│   ├── blockchain-client/    # Celo/cUSD payment helpers
│   ├── ai-client/            # AI provider abstractions
│   ├── agent-web-bridge/     # Python FastAPI browser automation
│   ├── db/                   # Drizzle schema + migrations (Neon)
│   ├── storage/              # Cloudflare R2 helpers
│   └── eslint-config/        # Internal linting config
├── deploy/                   # Hetzner VPS deployment scripts
├── scripts/                  # Reference agents, ops audits, seeding
└── docs/                     # Documentation (see docs/README.md)
```

## Development Commands

```bash
pnpm dev          # Start all apps in development mode
pnpm build        # Build all packages and apps
pnpm lint         # ESLint across the monorepo (web uses `eslint .`; Next 16 removed `next lint`)
pnpm check-types  # TypeScript type checking
pnpm format       # Prettier formatting
pnpm --filter @onpoint/api test  # API tests (no live DB required)
```

### API test modes

API tests are hermetic by default. Curator route tests exercise both missing
and fake database configuration without contacting Neon. Linq tests force the
mock transport with `LINQ_MOCK=1`, so a developer shell with live
`LINQ_API_KEY` credentials cannot accidentally send a real message. The
production Linq client remains live whenever `LINQ_API_KEY` is configured;
`LINQ_MOCK=1` is test/demo-only and must not be set in production.

### Fresh checkout: build workspace packages first

API tests import the compiled output of `@onpoint/shared-types`, `@repo/agent-core`, `@repo/storage`, and
`@repo/db` (`dist/`). On a fresh checkout, `pnpm install --ignore-scripts` is not enough — tests fail with
`Cannot find module …/dist/index.cjs` until you build them:

```bash
for p in shared-types agent-core storage db; do (cd packages/$p && ../../node_modules/.bin/tsup); done
```

`pnpm run test` (turbo) builds dependencies first because `test` depends on `^build` in `turbo.json`; running `vitest` directly inside `apps/api` does not, which is why the manual build is needed there.

### Type-checking static image imports

`apps/web/next-env.d.ts` is generated and gitignored, so a clean checkout (CI) has no types for
`import img from "./x.png"`. `apps/web/image-types.d.ts` is tracked for that reason — do not delete it.

## Dependency Policy

Patch/minor upgrades on sight. Majors only on a trigger: security advisory,
deprecation, a needed feature, or planned work in that subsystem.

Current deferred majors (deliberate, not debt):

- **tailwind 3→4** — config paradigm migration with visual-default changes;
  a storefront's rendered output is the product, so defer until a design refresh.
- **wagmi 3** — checkout critical path; stay on 2.x until a security advisory,
  RainbowKit dropping v2, or a v3-only feature forces it.
- **hardhat 3** — contracts are dormant; migrate only before the next
  contract iteration.
- **typescript 7 (tsgo)** — adopted for web `check-types` only (~4min → ~5s);
  builds still run real `tsc` via `next build`, which remains the canonical gate.

Behavior changes from majors already adopted (check these when touching the code):

- **express 5** — `app.listen(port, host, cb)` calls `cb` with an error when binding fails, so the callback must
  check its argument or a failed bind looks like a successful start. Handle it in every entrypoint.
- **ioredis 6** — commands issued while disconnected queue indefinitely instead of rejecting. Bound any
  health/readiness call with a timeout.
- **spectrum-ts 12** — adds roughly 75 MB to the API bundle (see the size limit in `deploy/README.md`).

## Deployment

### Fly.io (Frontend)

The web app deploys as a standalone Next.js container via `fly.web.toml` + root `Dockerfile`:

1. `fly deploy -c fly.web.toml` (app name `onpoint-web`, set in `fly.web.toml`). Deploy the API first when a change adds API endpoints the web app calls. **Before deploying, make sure `ADMIN_EMAILS` (or `ADMIN_EMAIL`) is set to a verified Auth0 email**, or the admin console returns 503 (the gate fails closed)
2. `NEXT_PUBLIC_*` values live in `[build.args]` (inlined at build time)
3. Runtime secrets via `fly secrets set` — `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `APP_BASE_URL`; `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` are `NEXT_PUBLIC`-style build args in `fly.web.toml`

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

The API deploys from CI on pushes to `master` that touch the API (GitHub Actions → SSH → PM2). See [deploy/README.md](../deploy/README.md) for the pipeline, secrets, rollback, and troubleshooting.

## Agent Web-Bridge (Python Microservice)

The autonomous browsing component runs separately:

```bash
cd packages/agent-web-bridge
pip install -r requirements.txt
uvicorn main:app --reload
# → API: http://localhost:8000
```

See [packages/agent-web-bridge/README.md](../packages/agent-web-bridge/README.md) for details.
