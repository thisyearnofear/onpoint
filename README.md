# OnPoint — Agentic Fashion Commerce

> **Fit before you buy — for people and agents.**

OnPoint turns live fashion inventory into **fit-aware, machine-readable, locally payable offers**.

- **Humans** shop branded storefronts (`/s/[slug]`) with AI try-on → WhatsApp / M-Pesa checkout
- **Agents** execute against the **same inventory** via structured offers, paid try-on, checkout, and receipts
- **Curators** supply inventory, stock truth, local ops, and distribution

**Live:** [onpoint.trustfall.xyz](https://onpoint.trustfall.xyz) · **API:** [api.onpoint.famile.xyz](https://api.onpoint.famile.xyz) · **Manifest:** [/.well-known/agent.json](https://onpoint.trustfall.xyz/.well-known/agent.json)

[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://onpoint.trustfall.xyz)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Registered-blue)](https://8004scan.io/agents/celo/9177)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Strategy: [`docs/STRATEGY.md`](docs/STRATEGY.md).

---

## What It Does

**Curators** — branded `/s/[slug]` storefronts, WhatsApp/M-Pesa checkout, AI try-on, on-chain agent payouts.

**Humans** — virtual try-on + fit signal before purchase, polaroid shares, no wallet required for first try-on.

**Agents** — `/.well-known/agent.json`, x402 try-on ($0.03/$0.05 cUSD) and checkout, looks composition, 2.5% referral commissions, ERC-8004 identity on Celo.

→ [Agent commerce guide](docs/guides/agent-commerce.md) · [AGENTS.md](./AGENTS.md)

### ChatGPT plugin — "will these fit me"

Thin packaging over the live MCP + agent surfaces (directory at [chatgpt.com/plugins](https://chatgpt.com/plugins)). Description in user words. **Free tools first** (browse, analyze, looks); **paid try-on / buy stay external** or existing-account only — do not complete x402 checkout inside ChatGPT (see OpenAI physical-goods commerce constraints in the playbook).

| | |
| --- | --- |
| MCP | `https://mcp.onpoint.famile.xyz` — streamable HTTP; 10 tools in [`agent.json`](https://onpoint.trustfall.xyz/.well-known/agent.json). **Deploy pending** — DNS/host not live yet (see [Connect](./docs/CHATGPT_PLUGIN_CONNECT.md)) |
| OpenAPI | [`https://api.onpoint.famile.xyz`](https://api.onpoint.famile.xyz) · [`/openapi.json`](https://onpoint.trustfall.xyz/openapi.json) |
| Playbook | [`docs/CHATGPT_PLUGIN_PLAYBOOK.md`](docs/CHATGPT_PLUGIN_PLAYBOOK.md) |
| Connect | [`docs/CHATGPT_PLUGIN_CONNECT.md`](docs/CHATGPT_PLUGIN_CONNECT.md) |
| Eval set | [`docs/CHATGPT_PLUGIN_EVAL.md`](docs/CHATGPT_PLUGIN_EVAL.md) |
| Starter prompts | [`docs/CHATGPT_PLUGIN_STARTER_PROMPTS.md`](docs/CHATGPT_PLUGIN_STARTER_PROMPTS.md) |
| Scoreboard | Weekly usage → monetisation metrics in [`docs/CHATGPT_PLUGIN_PLAYBOOK.md`](docs/CHATGPT_PLUGIN_PLAYBOOK.md#usage--monetisation-scoreboard-plugin-lane) |
| Growth loop | Look collages and polaroids are the shareable surface; 2.5% referral commissions reward agents that drive purchases. Shares carry an id so the funnel (share → visit → CTA → try-on → order) and K-factor are measurable; buy stays off-platform. No K-factor is claimed until measured: [`docs/ops/growth-loop.md`](docs/ops/growth-loop.md) · [`docs/ops/invite-flow-teardown.md`](docs/ops/invite-flow-teardown.md) |

Free discovery: `browse_curator_directory`, `browse_storefront`, `analyze_outfit`, `analyze_african_textile`, `list_looks`, `get_look`, `create_look`, `check_earnings`. Paid (product/agent URLs only): `try_on`, `buy_item`.

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
| [Docs index](docs/README.md) | Full map — guides, ops, ADRs, research |
| [Architecture](docs/ARCHITECTURE.md) | Stack, layers, data flow |
| [Agent commerce](docs/guides/agent-commerce.md) | Third-party agent how-to |
| [ChatGPT plugin playbook](docs/CHATGPT_PLUGIN_PLAYBOOK.md) | Oct 2026 packaging · free first · commerce constraints |
| [ChatGPT connect / eval / starters](docs/CHATGPT_PLUGIN_CONNECT.md) | MCP connect steps · intent eval · directory prompts |
| [AGENTS.md](./AGENTS.md) | Full API reference |

Agent identity: [ERC-8004 #9177](https://8004scan.io/agents/celo/9177) · wallet [`0x5b33…24fB`](https://celoscan.io/address/0x5b33E63440e95289207120B94da78CE22F9D24fB)

---

**[Live Demo](https://onpoint.trustfall.xyz)** · [GitHub](https://github.com/thisyearnofear/onpoint) · MIT

## NEAR HACKATHON

OnPoint is being adapted for the NEAR HACKATHON (Nov 1–14, 2026) under the **Agent Economy** track. See [`HACKATHON.md`](./HACKATHON.md) and [`docs/NEAR_HACKATHON.md`](./docs/NEAR_HACKATHON.md) for the NEAR integration plan, tools, demo script, and submission checklist.

### Do X, see Y — reproduce the NEAR agent-payment demo

The NEAR rail lets an agent pay for try-on/checkout and settle the curator **directly** in the same transaction. Verified end-to-end on testnet against the live API code.

```bash
cd scripts/near-spike
npm install
node provision.mjs   # creates + funds onpoint.testnet sub-accounts (~30s)
node agent-demo.mjs  # narrated run: offer → 402 → pay → 201 → settled payout
```

What you see:

1. `GET /api/curator/onpoint-store/storefront` — a payable offer (house catalog; no third-party curator needed)
2. `POST /api/agent/try-on` → **HTTP 402** with `quote.paymentRails: ["celo_cusd","near"]` and a `quote.near` block (account, yoctoNEAR, network)
3. Agent sends NEAR on testnet → re-POSTs `{nearAccountId, nearTxHash}` → server verifies on-chain via JSON-RPC
4. `POST /api/curator/onpoint-store/order` → **HTTP 201** — order confirmed, `payout.status: "settled"`, nearblocks explorer links, receipt URL
5. Curator's NEAR balance increases **in the same transaction** — payment *is* the payout

API surface: `apps/api/lib/near-payments.js` (dependency-free `EXPERIMENTAL_tx_status` verification), rail wired into `routes/agent-tryon.js` and `routes/curator-storefront.js`. Config via `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_USD_PRICE`, `NEAR_PAYOUT_ACCOUNT` (see `apps/api/.env.example`); per-curator override via `commerce.nearAccountId`.

## PayPal AI Hackathon

OnPoint is being adapted for the PayPal AI Hackathon (submissions Oct 1 – Nov 12, 2026) under the “Build What’s Next with PayPal and AI” theme. See [`PAYPAL_HACKATHON.md`](./PAYPAL_HACKATHON.md) and [`docs/PAYPAL_HACKATHON.md`](./docs/PAYPAL_HACKATHON.md) for the PayPal integration plan, tools, demo script, and submission checklist.
