# OnPoint — The Fashion Execution Rail for AI Agents

> **Fit before you buy — for people and agents.**

OnPoint turns live fashion inventory into **fit-aware, machine-readable, locally payable offers**.

- **Humans** shop on branded storefronts (`/s/[slug]`) with AI try-on → WhatsApp / M-Pesa.
- **Agents** execute against the **same inventory** via structured offers, paid try-on, permissioned checkout, and verifiable receipts.
- **Curators** (human, AI, digital) supply the hard-to-structure inventory, stock truth, local operations, and distribution.

**The wedge is fashion; the larger thesis is agent-ready execution infrastructure for fit-sensitive physical goods.** We are proving that abstraction in fashion first, not claiming to be a generic commerce OS today.

```text
Messy inventory → structured offer → fit confidence → local checkout → outcome
```

Research rationale and evidence boundaries: [`docs/STRATEGY.md`](./docs/STRATEGY.md).

[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://beonpoint.netlify.app)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Registered-blue)](https://8004scan.io/agents/celo/9177)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Qwen Cloud Hackathon](https://img.shields.io/badge/Qwen%20Cloud-Hackathon%20Track%204-orange)](./docs/QWEN-CLOUD-HACKATHON.md)

## Proof point: Agentic Commerce Hackathon — Prava × Visa × Linq

> This hackathon work is a proof point for the fashion execution rail—not a separate company thesis. **OnPoint is the fashion agent that earns permission to buy.** It discovers
> live merchant inventory, checks fit on the shopper, locks a binding quote,
> and requests the narrowest useful payment permission through Prava. Linq is
> the message-native control plane: a web mission can move into Messages
> without creating a second order. One-time credentials remain server-side.

**Validated sandbox transaction:** a live Alo Yoga SKU produced a binding `$117.32
USD` quote (`$108.00` item + `$0.00` shipping + `$9.32` tax). Prava reached
`Creds_Generated`—which Prava confirmed is a successful Prava transaction—and
OnPoint's poll reached `credential_ready`. One subsequent
Browser Harness attempt timed out with an unknown outcome, so OnPoint stopped,
did not retry, and reported no invented approval or decline. **No Alo Yoga order,
charge, approval, or decline is claimed.**

- Submission evidence and track mapping: [`docs/PRAVA-HACKATHON.md`](./docs/PRAVA-HACKATHON.md)
- 105-second recording script: [`docs/PRAVA-DEMO-SCRIPT.md`](./docs/PRAVA-DEMO-SCRIPT.md)
- Architecture decision: [`docs/adr/0017-prava-agent-checkout.md`](./docs/adr/0017-prava-agent-checkout.md)
- Reproducible fixture-only walkthrough: `node scripts/prava-demo.mjs`

**Hackathon disclosure:** OnPoint's storefronts, try-on, inventory APIs,
referrals, and public agent identity existed before this event. The Prava UCP
discovery/quote/session state machine, server-held credential flow, order-aware
Prava return, Linq signed webhook/same-mission status-card interface, OpenAI
intent compiler, safety boundaries, and demo evidence were built during the
Agentic Commerce Hackathon. The OpenAI compiler falls back losslessly and is
credited in the UI only when the OpenAI API actually runs.

---

<details>
<summary><strong>Prior proof point: Qwen Cloud Hackathon</strong></summary>

> **Qwen Cloud Hackathon — Track 4: Autopilot Agent.** This is a historical proof point for the same fashion execution thesis. OnPoint is an autopilot agent that turns a photo of an outfit into a verifiable on-chain purchase from a real African fashion curator — perceiving with **Qwen3-VL on Qwen Cloud (DashScope)**, reasoning about fit and cultural context (Ankara / Kente / Adire / Bogolan / Shweshwe), and acting through x402-paid try-on and Celo checkout, with a human-in-the-loop checkpoint above $5.
>
> - Submission writeup + architecture diagram: [`docs/QWEN-CLOUD-HACKATHON.md`](./docs/QWEN-CLOUD-HACKATHON.md)
> - Alibaba Cloud deployment proof: [`packages/storage/src/oss.ts`](./packages/storage/src/oss.ts)
> - Qwen Cloud client: [`packages/qwen-cloud/`](./packages/qwen-cloud/)
> - Qwen Cloud MCP server: [`packages/qwen-mcp/`](./packages/qwen-mcp/)
> - Autopilot demo script: [`scripts/qwen-autopilot.mjs`](./scripts/qwen-autopilot.mjs)
> - Implementation plan: [`plans/qwen-cloud-hackathon.md`](./plans/qwen-cloud-hackathon.md)

</details>

**Canonical strategy:** [`docs/STRATEGY.md`](./docs/STRATEGY.md) — thesis, wedge, market rationale, phases, metrics, evidence boundaries, and expansion gates. Do not fork strategy copy elsewhere.

**Current phase:** Prove the fashion wedge (Q3 2026) — densify **agent-purchasable** inventory, improve catalog freshness/fit truth, and prove third-party agent execution in parallel. Ops: `node scripts/agent-commerce-ready.mjs` (directory gate) or `node scripts/trusted-offer-audit.mjs` (listing-level baseline) · [PHASE1_AUDIT.md](./docs/PHASE1_AUDIT.md).

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
- x402 try-on ($0.03 digital / $0.05 physical, cUSD) and storefront checkout with curator splits
- **Agent looks** — compose curator inventory into shareable style boards with AI-generated collages, auto-classified metadata (category/occasion/season), and try-on share cards. SDK helpers in `@repo/agent-core` (`browseLooks`, `createLook`, `getLook`). Reference script: `scripts/agent-looks.mjs`
- Referral tracking — agents earn 2.5% commission on referred purchases
- Agent dashboard at `/agent` — earnings, referral stats, activity feed
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
- **AI**: **Qwen Cloud (DashScope)** — qwen-vl-max-latest, qwen-plus (primary); Venice, Gemini, 0G Compute Router (fallbacks)
- **API / autonomy**: Hetzner (Express, worker, signer, Python bridge) — [ADR 0001](./docs/adr/0001-backend-first-autonomy.md)
- **Data**: Neon Postgres, Redis, Cloudflare R2, **Alibaba Cloud OSS** (try-on artifact mirror)
- **Payments**: M-Pesa (Daraja), cUSD on Celo (x402)
- **Presentation**: Netlify / Vercel
- **Agent runtime**: Qwen Cloud MCP server ([`packages/qwen-mcp/`](./packages/qwen-mcp/))

**Monorepo:** `apps/web` · `apps/api` · `apps/bridge` · `packages/*`

---

## Documentation

| Doc                                        | Owns                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Strategy](docs/STRATEGY.md)               | Vision, phases, metrics, decisions                                                                                                                                                                                                                                |
| [Phase 1 audit](docs/PHASE1_AUDIT.md)      | Wedge-readiness audit, historical evidence, and refresh checklist                                                                                                                                                                                                 |
| [Architecture](docs/ARCHITECTURE.md)       | Layers, data flow, topology                                                                                                                                                                                                                                       |
| [Features](docs/FEATURES.md)               | Feature specs                                                                                                                                                                                                                                                     |
| [Getting Started](docs/GETTING_STARTED.md) | Setup & deploy                                                                                                                                                                                                                                                    |
| [Monitoring](docs/MONITORING.md)           | Ops dashboards                                                                                                                                                                                                                                                    |
| [Guides](docs/guides/)                     | Auth, WhatsApp, MiniPay, [Agent commerce](docs/guides/agent-commerce.md), [Curator wallets](docs/guides/curator-payout-wallets.md), [Merchant scorecard](docs/guides/merchant-onboarding-scorecard.md), [Weekly pilot report](docs/guides/weekly-pilot-report.md) |
| [ADRs](docs/adr/)                          | Decision records                                                                                                                                                                                                                                                  |

---

## Agent Identity

|                         |                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------- |
| **ERC-8004**            | [9177](https://8004scan.io/agents/celo/9177)                                            |
| **Agent wallet (Celo)** | [`0x5b33…24fB`](https://celoscan.io/address/0x5b33E63440e95289207120B94da78CE22F9D24fB) |

Worker cycles (heartbeat, market signals, optional auto-buy) run on Hetzner PM2 — see Strategy + Architecture for role (infrastructure, not the product hero).

---

## Testing

[TestSprite](https://github.com/TestSprite/testsprite-cli) covers curator/storefront journeys against [beonpoint.netlify.app](https://beonpoint.netlify.app). See [`LOOP.md`](./LOOP.md) and [`.github/workflows/testsprite.yml`](.github/workflows/testsprite.yml).

---

**[Live Demo](https://beonpoint.netlify.app)** · [GitHub](https://github.com/thisyearnofear/onpoint) · MIT
