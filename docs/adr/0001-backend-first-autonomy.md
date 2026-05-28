# ADR 0001 — Backend-First Autonomy

- **Status:** Active — Phase 0 (Deploy Pipeline) ✅ Complete 2026-05-26
- **Date:** 2026-05-26
- **Deciders:** OnPoint core
- **Supersedes:** —
- **Related:** [ARCHITECTURE.md](../ARCHITECTURE.md), [HETZNER_CONFIG.md](../../HETZNER_CONFIG.md), [SECURE_WALLET_SETUP.md](../SECURE_WALLET_SETUP.md)

## Context

Recent autonomy work (commits `b041fae`, `5cfa081`) shipped:

- `autonomous-executor.ts` that signs onchain via `viem` using `AGENT_PRIVATE_KEY`
- New agent endpoints under `apps/web/app/api/agent/*` — `heartbeat`, `identity`, `dashboard`, `suggestion`, `mint`, `purchase`, `tip`, `checkout`, `schedule-event`, `missions`, `fraud`, `escrow`, `treasury`
- Self Protocol integration, ERC-8004 registration (agent ID 9177), agent.json well-known
- Fraud detection, dead-man's-switch, verifiable receipts

All of this lives in **Vercel Next.js functions**. The Hetzner backend (`snel-bot`) only serves heavy AI inference (`/api/ai/*`) and the Python `agent-web-bridge`. Discovered drift:

- `/opt/onpoint` on snel-bot is **not** a git checkout — `deploy.sh`'s `git pull` silently fails.
- Deployed `apps/api/server.js` (v2.0.0 with global 50 MB parser, no auth, no rate limit) is behind the local hardened version.
- `/opt/onpoint/api/routes/ai-agent.js` exists on disk but is **not mounted** in `server.js`.
- `AGENT_PRIVATE_KEY` lives in Vercel envs — every serverless cold start can sign anything.
- `/api/agent/heartbeat` exists but nothing calls it on a schedule.
- A stale `/opt/onpoint-agent-bridge` duplicate folder is not used by PM2 but causes confusion.

The product promise — *"the agent does things while you sleep"* — does not match an architecture built on ephemeral, 60-second-capped, cold-start serverless functions.

## Decision

Treat **Hetzner as the agent's home** and **Vercel as the presentation + identity layer**. Migrate stateful, long-running, signing, and scheduled work to Hetzner. Isolate the signer behind a loopback-only process. Make Redis on snel-bot the single source of truth for agent state.

### Operating principles

1. **Vercel = presentation + identity.** Hetzner = autonomy + AI + signer + state.
2. **The signer is the only thing that holds the key**, behind a loopback socket, with its own policy gate. A leaked Vercel env or XSS can never sign.
3. **One Redis on Hetzner is the source of truth** for spending limits, suggestions, fraud state, mission queue — no dual-write risk.

## Target Architecture

```diagram
╭──────────────────────────────────────────────────────────────╮
│                    Vercel / Netlify (Next 16)                 │  ← UI, auth, SSR, Stripe, public reads
│                    apps/web — thin BFF                        │     Forwards agent intents to Hetzner
╰──────────────────────────┬───────────────────────────────────╯
                           │  HTTPS, HMAC-signed service token
                           │  + per-user JWT (forwarded)
╭──────────────────────────▼───────────────────────────────────╮
│                Hetzner snel-bot (the agent's home)            │
│  ╭─────────────────────────────────────────────────────────╮ │
│  │ onpoint-api      (Express, :48751, public via nginx)    │ │  AI inference + agent endpoints
│  │   /api/ai/*    │   /api/agent/*  │  /api/agent/heartbeat │ │
│  ╰─────────────────────────────────────────────────────────╯ │
│  ╭─────────────────────────────────────────────────────────╮ │
│  │ onpoint-worker   (Node, no port — BullMQ + node-cron)   │ │  Loops, retries, schedules
│  │   heartbeat 5m  │  retry queue  │  scheduled missions   │ │
│  ╰─────────────────────────────────────────────────────────╯ │
│  ╭─────────────────────────────────────────────────────────╮ │
│  │ onpoint-signer   (Express, 127.0.0.1:48753 ONLY)        │ │  Sole holder of AGENT_PRIVATE_KEY
│  │   sign-and-broadcast │ enforces spend + fraud policy    │ │  Swappable for KMS/Turnkey later
│  ╰─────────────────────────────────────────────────────────╯ │
│  ╭─────────────────────────────────────────────────────────╮ │
│  │ onpoint-bridge   (FastAPI, :48752) — Browser-Use/Purch  │ │  Already correct
│  ╰─────────────────────────────────────────────────────────╯ │
│  ╭─────────────────────────────────────────────────────────╮ │
│  │ Redis :6379 — single source of truth for agent state    │ │
│  ╰─────────────────────────────────────────────────────────╯ │
╰──────────────────────────────────────────────────────────────╯
```

### Ownership split

| Concern                                            | Vercel | Hetzner |
| -------------------------------------------------- | :----: | :-----: |
| UI, SSR, static, image opt                         |   ✅   |         |
| Auth (NextAuth, Worldcoin, MiniPay, wallet sign)   |   ✅   |         |
| Stripe webhooks                                    |   ✅   |         |
| Cacheable public reads (catalog, storefront)       |   ✅   |         |
| AI inference (Venice, Gemini, Virtual Try-On)      |        |   ✅    |
| `/api/agent/*` stateful endpoints                  |        |   ✅    |
| Heartbeat loop, schedulers, retry queues           |        |   ✅    |
| `AGENT_PRIVATE_KEY` + onchain signing              |        |   ✅    |
| Redis (agent state, spending limits, fraud)        |        |   ✅    |
| Browser automation (Purch / TinyFish / Browser-Use)|        |   ✅    |

## Migration Plan (5 phases, ship incrementally)

### Phase 0 — Unblock the pipeline ✅ Complete 2026-05-26
- ✅ **`scripts/deploy-api.sh`** — rsync-based deploy with workspace package builds, isolated `npm install --omit=dev`, size check, symlink flip, PM2 reload, health check, auto-rollback, and release pruning.
- ✅ **`scripts/rollback-api.sh`** — interactive release picker with auto-revert on health check failure.
- ✅ **`scripts/setup-secrets.sh`** — secure hidden-input secret loader (SSH pipe, never stored locally).
- ✅ **`shared/api/.env`** — single source of truth for secrets, symlinked into each release on deploy.
- ✅ **`pnpm deploy:api`** — convenience npm script.
- ✅ **`pm2 save && pm2 startup`** — process lineup survives reboot.
- ✅ **`.github/workflows/deploy-api.yml`** — auto-deploy on master pushes (needs GH Secrets configured).
- ✅ **Size thresholds** — 100MB warn / 200MB fail.
- ✅ **Absolute symlink path fix** — resolved relative symlink resolution bug.
- ✅ **Server cleanup** — ~1GB reclaimed (journal vacuum, stale bridge removal).
- ✅ **Live deploy verified** — release `20260526-130237` passing health checks.
- ✅ **`SERVICE_API_KEY` introduced** — service-to-service auth separate from `VENICE_API_KEY`.
- ✅ **Fixed syntax error** in `ai-live-session.js` discovered during deploy debugging.

### Phase 1 — Real heartbeat + observability (1–2 days)
- New PM2 process **`onpoint-worker`** running `node-cron`. First job: POST `/api/agent/heartbeat` every 5 min with `SERVICE_API_KEY`. The "self-monitoring agent" becomes real.
- Mount the orphaned `/opt/onpoint/api/routes/ai-agent.js` at `/api/ai/agent` with auth + rate-limit — or delete it.
- Sentry on both sides with a shared release SHA so a user's `suggestionId` traces across Vercel → Hetzner.
- A tiny `status.onpoint.famile.xyz` page pinging health, agent gas, Redis, bridge, Venice. Trust is built by being seen working.

### Phase 2 — Extract `packages/agent-core` (3–5 days)
Move these from `apps/web/lib/` into a new workspace package that both Vercel and Hetzner can import:
- `agent-controls`, `agent-store`, `fraud-detection`, `agent-registry`, `agent-reputation`, `mission-service`, `treasury-service`, `escrow-service`, `spend-policy`, `autonomous-executor`.

Prerequisite for everything else. Lets us migrate endpoints one-at-a-time without breaking Vercel.### Phase 3 — Port stateful agent endpoints to Hetzner ✅ Complete 2026-05-26

All 16 agent routes ported from Vercel to Hetzner Express (no proxy fallback needed):
- ✅ `/api/agent/heartbeat`, `/suggestion`, `/dashboard`, `/identity`, `/wallet`
- ✅ `/api/agent/schedule-event`, `/missions`, `/treasury`, `/fraud`, `/escrow`
- ✅ `/api/agent/mint`, `/purchase`, `/tip`, `/tip-agent`, `/checkout`, `/approval`, `/style`
- ✅ All backed by `@repo/agent-core` (workspace package built to CJS via tsup)
- ✅ `@repo/blockchain-client` and `@onpoint/shared-types` also CJS-buildable
- ✅ Forwarded user context middleware for Vercel→Hetzner auth flow
- ✅ `SERVICE_API_KEY` on all stateful endpoints; public GET for read-only
- ✅ Sentry integration (optional, conditional on SENTRY_DSN)
- ✅ Deploy scripts updated: `scripts/deploy-api.sh` builds workspace deps, bundles `@repo/db` + `@repo/storage`, and deploys via isolated `npm install --omit=dev`

Vercel keeps:
- `/api/stripe/webhook` (low-latency to Stripe edges)
- Auth/session callbacks
- Cacheable public reads (`/api/agent/catalog` → proxies to Hetzner)
- All UI/SSR

### Phase 4 — Isolate the signer (3–5 days)
- New PM2 process `onpoint-signer`, listens on `127.0.0.1:48753` only.
- Removes `AGENT_PRIVATE_KEY` from Vercel envs entirely. Vercel can no longer sign — by design.
- API: `POST /sign { intent: { action, amount, recipient, suggestionId, ctx } }` → re-validates spend policy, daily signing budget, frozen state, fraud score; returns `{ txHash }` or `403 { reason }`.
- Every signature logged with reason → onchain receipt via `recordReceipt`. Transparency story stops being aspirational.
- Behind the same socket interface, swap in **Turnkey / AWS KMS / Fireblocks** later without touching callers.

### Phase 5 — Real-time UX (ongoing)
- **Server-Sent Events** from Hetzner → web for a live activity feed ("Agent analyzing… Agent suggests… Agent executed 0x…"). Vercel functions are terrible at long-lived connections; Hetzner excels.
- **Idempotency keys** on signer endpoints — no double-mint if a user double-taps on flaky mobile.
- **Optimistic UI** for accepted suggestions; reconcile when the worker confirms tx.
- **BullMQ queues** on the worker: mint retries, IPFS pinning, tx monitoring, email digest, daily proactive suggestions per active user.
- A **per-user activity timeline** sourced from Redis, surfaced in the UI. "Verifiable receipts" becomes something users actually see.

## Product & Strategy Rationale

- **Autonomy needs persistence.** Serverless is great for request/response, hostile to "while you sleep." The loop must live on Hetzner for the marketing copy to be true.
- **Trust > features.** Signer isolation, dead-man's-switch, gas-low alerts, public status page — these are sales material for a crypto-curious user about to authorize an agent to spend their money.
- **Failure must be visible, not silent.** Today a failed autonomous execution dies in a Vercel log. With the worker, every failure becomes a retry and ultimately a user-visible "agent paused — review action" card. Reliability *as a feature*.
- **Delight = activity feed + low latency.** SSE-driven "agent is doing X right now" + sub-second action ack is the demoable moment that converts skeptics. Today's `POST → wait 8s → poll` doesn't.
- **Cost.** Hetzner CX22 is ~€5/mo with capacity you're already paying for. Migrating agent endpoints off Vercel functions saves money exactly when you start succeeding (high-traffic users have lots of agent actions, not lots of page views).

## Concrete Next 5 PRs

1. **chore(deploy):** rsync-based GitHub Actions deploy to snel-bot, real git clone in `/opt/onpoint` — fixes drift permanently.
2. **fix(api):** deploy v2.0.0 server.js with rate-limit + API-key auth + per-route body limits — closes the open Venice cost-hole.
3. **feat(worker):** new `onpoint-worker` PM2 process running heartbeat cron + Sentry — autonomy heartbeat goes live.
4. **refactor:** extract `packages/agent-core` from `apps/web/lib` — unblocks everything after.
5. **docs(adr):** this document — capture the decision so contributors understand the *why*.

## Consequences

### Positive
- Autonomy becomes literally true (persistent loops, real schedulers, retries).
- Key-material blast radius shrinks to one isolated process.
- Single source of truth for agent state (Redis on Hetzner).
- Lower Vercel cost as scale grows.
- Clean future swap-in for HSM / KMS / Turnkey without rewiring callers.
- A unified observability trace per user action.

### Negative / risks
- One more deployment target to operate (`onpoint-worker`, `onpoint-signer`).
- snel-bot becomes a higher-value attack target → must harden (ssh keys only, fail2ban, ufw, signer on loopback only, regular `pm2 update` + apt updates).
- Migration window: every endpoint moved must keep a Vercel proxy in place until clients are updated, or risk breakage.
- Hetzner is single-region; a future SLA may demand a warm standby. Out of scope here, called out for awareness.

### Neutral
- `apps/web/lib` shrinks as `packages/agent-core` grows — a refactor cost, but improves separation of concerns.
- The Python bridge stays as-is. No change needed.

## Out of Scope (for now)
- Multi-region / HA failover for snel-bot.
- Replacing PM2 with systemd or k8s.
- KMS/HSM integration (slotted behind the signer interface for later).
- Migrating Stripe webhooks off Vercel.
