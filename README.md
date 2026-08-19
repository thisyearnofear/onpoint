# OnPoint — Agentic Fashion Commerce

> **Fit before you buy — for people and agents.**

OnPoint turns live fashion inventory into **fit-aware, machine-readable, locally payable offers**.

- **Humans** shop branded storefronts (`/s/[slug]`) with AI try-on → WhatsApp / M-Pesa checkout
- **Agents** execute against the **same inventory** via structured offers, paid try-on, checkout, and receipts
- **Curators** supply inventory, stock truth, local ops, and distribution

**Live:** [beonpoint.netlify.app](https://beonpoint.netlify.app) · **API:** [api.onpoint.famile.xyz](https://api.onpoint.famile.xyz) · **Manifest:** [/.well-known/agent.json](https://beonpoint.netlify.app/.well-known/agent.json)

[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://beonpoint.netlify.app)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Registered-blue)](https://8004scan.io/agents/celo/9177)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Built with [Factory Droid](https://factory.ai/product/droid) — [details](docs/BUILT-WITH-DROID.md). Strategy: [`docs/STRATEGY.md`](docs/STRATEGY.md).

---

## What It Does

**Curators** — branded `/s/[slug]` storefronts, WhatsApp/M-Pesa checkout, AI try-on, on-chain agent payouts.

**Humans** — virtual try-on + fit signal before purchase, polaroid shares, no wallet required for first try-on.

**Agents** — `/.well-known/agent.json`, x402 try-on ($0.03/$0.05 cUSD) and checkout, looks composition, 2.5% referral commissions, ERC-8004 identity on Celo.

→ [Agent commerce guide](docs/guides/agent-commerce.md) · [AGENTS.md](./AGENTS.md)

---

## Quick Start

```bash
git clone https://github.com/thisyearnofear/onpoint.git && cd onpoint
pnpm install && cp apps/web/.env.example apps/web/.env.local && pnpm dev
# → http://localhost:3000
```

[Getting Started](docs/GETTING_STARTED.md) for env vars and deployment.

---

## Docs

| | |
| --- | --- |
| [YouCam VTO](docs/YOUCAM-VTO.md) | Paid try-on provider (cloth-v4) |
| [Architecture](docs/ARCHITECTURE.md) | Stack, layers, data flow |
| [Features](docs/FEATURES.md) | Feature specs |
| [Agent commerce](docs/guides/agent-commerce.md) | Third-party agent how-to |
| [AGENTS.md](./AGENTS.md) | Full API reference |

Agent identity: [ERC-8004 #9177](https://8004scan.io/agents/celo/9177) · wallet [`0x5b33…24fB`](https://celoscan.io/address/0x5b33E63440e95289207120B94da78CE22F9D24fB)

---

**[Live Demo](https://beonpoint.netlify.app)** · [GitHub](https://github.com/thisyearnofear/onpoint) · MIT
