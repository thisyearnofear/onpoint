# OnPoint

> **Dress to the theme. Get judged. Come back tomorrow.**

OnPoint is a mobile-first fashion play space. The homepage is a **wardrobe studio**: a browsable gallery of prepared garments and AI outfit references with a clothes rack, on-model demos, pin-and-compare, and on-device saved picks. From there, **Runway** is the daily themed fit check judged by AI personas (Miranda, Edina, Shaft) — score paddles, a verdict, a shareable result, and "the fix" — and the fitting room handles personal try-on on your own photo.

**Current focus:** build the consumer engine and earn retention first. Curator storefronts, agent commerce and payment rails are built but **deferred** until the activation gate is met ([ADR 0023](docs/adr/0023-consumer-engine-first-curators-deferred.md)).

**Live:** [onpoint.trustfall.xyz](https://onpoint.trustfall.xyz) · **Play:** [/runway](https://onpoint.trustfall.xyz/runway) · **API:** [api.onpoint.famile.xyz](https://api.onpoint.famile.xyz) · **Manifest:** [/.well-known/agent.json](https://onpoint.trustfall.xyz/.well-known/agent.json)

[![Live Demo](https://img.shields.io/badge/Live-Demo-indigo)](https://onpoint.trustfall.xyz)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Registered-blue)](https://8004scan.io/agents/celo/9177)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Strategy: [`docs/STRATEGY.md`](docs/STRATEGY.md).

---

## What It Does

**Players (current focus)**: a wardrobe studio homepage (clothes rack, pin/compare, save, curated outfit references), Runway rounds on the web or iMessage, AI judges, result cards, looks and polaroids, AI try-on.

*Built and deferred (ADR 0023):*

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

## Pay the same offer three ways

One listing, one quote, three settled rails — the agent picks, and only one of them lets it spend without a human:

| Rail | Token | Proof an agent sends back | Human in the loop? |
| --- | --- | --- | --- |
| Celo x402 | cUSD / USDC | `paymentTxHash` (+ `quoteId`) | no |
| NEAR | NEAR | `nearTxHash` — payer derived from `transaction.signer_id`, verified trustlessly over JSON-RPC | no |
| PayPal | USD (sandbox/live) | `paypalOrderId` → the human approves at paypal.com, server captures, `captureId` is the proof | **yes, by design** |

`POST /api/agent/try-on` answers **HTTP 402** with `quote.paymentRails` listing what is currently configured; the paid re-POST returns the render, a fit signal and a shareable polaroid whose page prints the AI inference cost next to the payment.

```bash
# See the challenge (no wallet, no payment)
curl -sS -X POST https://api.onpoint.famile.xyz/api/agent/try-on \
  -H 'Content-Type: application/json' \
  -d '{"curatorSlug":"nia","listingId":"08fa3061-3054-4e6a-99ca-a146e2e88063","photoData":"data:image/jpeg;base64,…"}' | head -c 400

# Run a whole rail end to end (testnet/sandbox funds required)
node scripts/near-spike/agent-demo.mjs                      # RAIL=near (default)
RAIL=paypal node scripts/near-spike/agent-demo.mjs          # prints approveUrl; open it, approve, the script continues
node scripts/agent-buyer.mjs --dry-run                      # Celo flow without paying
```

### Judging path (no credentials needed)

`GET /.well-known/agent.json` → `GET /api/curator/directory?agentPurchasable=1` → `GET /api/curator/onpoint-store/storefront` (add `?type=top&formality=casual`) → `POST /api/agent/outfit` → free web try-on at [onpoint.trustfall.xyz/pay](https://onpoint.trustfall.xyz/pay). Paid steps print a real 402 without a wallet, so the challenge itself is inspectable; completed receipts stay readable at `GET /api/receipts/{receiptId}`.


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

Hackathon submissions: [HACKATHON.md](./HACKATHON.md) (NEAR) · [docs/PAYPAL_HACKATHON.md](docs/PAYPAL_HACKATHON.md) (PayPal). Reproducers live there.

## Flip the Switch Hackathon

OnPoint is being adapted for the Flip the Switch Hackathon (Nov 4–7, 2026) as a **team commerce agent** using Switch. See [`SWITCH_HACKATHON.md`](./SWITCH_HACKATHON.md) and [`docs/SWITCH_HACKATHON.md`](./docs/SWITCH_HACKATHON.md) for the Switch room workflow, demo script, and submission checklist.
