# OnPoint — Fit-Aware Fashion Execution

> **Fit before you buy — for people and agents.**

OnPoint is the **execution layer** for fashion intent that needs **fit + real stock + local pay**.

- **Humans** shop on branded storefronts (`/s/[slug]`) with AI try-on → WhatsApp / M-Pesa.
- **Agents** hit the **same inventory** via storefront APIs, x402 try-on, and on-chain checkout.
- **Curators** (human, AI, digital) are how truthful supply enters the graph — not a separate product.

[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://beonpoint.netlify.app)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Registered-blue)](https://8004scan.io/agents/celo/9177)

**Canonical strategy:** [`docs/STRATEGY.md`](./docs/STRATEGY.md) — north star, phases, metrics, kill list. Do not fork roadmap copy elsewhere.

**Current phase:** Supply Graph Readiness (Q3 2026) — densify **agent-purchasable** inventory (wallet + live physical SKUs) and third-party agent usage in parallel. Ops: `node scripts/agent-commerce-ready.mjs` · [PHASE1_AUDIT.md](./docs/PHASE1_AUDIT.md).

---

## What It Does

### Supply (Curators)
- Branded storefront at `/s/[your-name]` — one catalog for humans and agents
- M-Pesa + WhatsApp receipts; chat-ops inventory where possible
- AI try-on for customers; digital→physical discovery (e.g. Nia Digital → human SKUs)
- On-chain payouts when agents buy (`commerce.walletAddress`)

### Demand — Humans
- Virtual try-on and size/fit signal before purchase
- WhatsApp / M-Pesa checkout — no wallet/Auth0 before first try-on
- Polaroid share + cross-curator recommendations

### Demand — Agents
- `/.well-known/agent.json` + curator directory with structured offers
- x402 try-on ($0.25 cUSD) and storefront checkout with curator splits
- Verifiable receipts; ERC-8004 registration on Celo

**Organizing primitive:** [ADR 0002 — Curator](./docs/adr/0002-curator-primitive.md).  
**Agent commerce:** [ADR 0010](./docs/adr/0010-agent-storefront-checkout.md).

---

## Quick Start

```bash
git clone https://github.com/thisyearnofear/onpoint.git
cd onpoint
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
# → http://localhost:3000
```

See [Getting Started](docs/GETTING_STARTED.md) for env vars and full setup.

---

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind, Zustand
- **AI**: Venice, Gemini, OpenAI (+ fallbacks)
- **API / autonomy**: Hetzner (Express, worker, signer, Python bridge) — [ADR 0001](./docs/adr/0001-backend-first-autonomy.md)
- **Data**: Neon Postgres, Redis, Cloudflare R2
- **Payments**: M-Pesa (Daraja), cUSD on Celo (x402)
- **Presentation**: Netlify / Vercel

**Monorepo:** `apps/web` · `apps/api` · `apps/bridge` · `packages/*`

---

## Documentation

| Doc | Owns |
|-----|------|
| [Strategy](docs/STRATEGY.md) | Vision, phases, metrics, decisions |
| [Phase 1 audit](docs/PHASE1_AUDIT.md) | Kill list + surface priorities |
| [Architecture](docs/ARCHITECTURE.md) | Layers, data flow, topology |
| [Features](docs/FEATURES.md) | Feature specs |
| [Getting Started](docs/GETTING_STARTED.md) | Setup & deploy |
| [Monitoring](docs/MONITORING.md) | Ops dashboards |
| [Guides](docs/guides/) | Auth, WhatsApp, MiniPay, [Agent commerce](docs/guides/agent-commerce.md) |
| [ADRs](docs/adr/) | Decision records |

---

## Agent Identity

| | |
|--|--|
| **ERC-8004** | [9177](https://8004scan.io/agents/celo/9177) |
| **Agent wallet (Celo)** | [`0x5b33…24fB`](https://celoscan.io/address/0x5b33E63440e95289207120B94da78CE22F9D24fB) |

Worker cycles (heartbeat, market signals, optional auto-buy) run on Hetzner PM2 — see Strategy + Architecture for role (infrastructure, not the product hero).

---

## Testing

[TestSprite](https://github.com/TestSprite/testsprite-cli) covers curator/storefront journeys against [beonpoint.netlify.app](https://beonpoint.netlify.app). See [`LOOP.md`](./LOOP.md) and [`.github/workflows/testsprite.yml`](.github/workflows/testsprite.yml).

---

**[Live Demo](https://beonpoint.netlify.app)** · [GitHub](https://github.com/thisyearnofear/onpoint) · MIT
