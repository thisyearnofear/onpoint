# OnPoint × Otari — Devs Wilding submission notes

OnPoint is the trusted execution rail for agentic fashion commerce: agents
discover inventory, pay per action (x402/cUSD on Celo, NEAR, PayPal), try on,
order, and earn — over real merchant stock. The missing rail was **AI spend**:
an agent that pays for every action also needs its model calls metered,
budget-capped, and attributable. Otari is that rail.

## Otari features used

| Otari feature | Where OnPoint uses it |
| --- | --- |
| OpenAI-compatible gateway (chat + vision) | Fallback upstream for persona chat, outfit/vision analysis, look classification, garment attributes, product search — see `packages/qwen-cloud/src/otari.ts`, `apps/api/routes/ai-agent.js`, `apps/api/lib/vision.js`. Still **first** for any call carrying `x-otari-key` |
| Per-request server cost (`usage.cost_usd`) | Surfaced to callers as `aiCost` on `/api/ai/agent` and `/api/agent/try-on` responses and as `estimatedCostUsd` in `qwen-cloud` results — real settled cost, not an estimate |
| Self-serve key reads (`/key/usage/summary`, `/key/budget`) | `GET /api/agent/ai-usage` — an agent reconciles its own AI spend, the same ledger shape as its cUSD payment ledger |
| Virtual keys + scoped budgets (`/keys`, `/budgets`, `/scoped-budgets`) | `OtariAdminClient` + `scripts/otari-agent-keys.mjs provision` mints a budget-capped key per agent (`OTARI_ADMIN_KEY`, master-key only; dashboard on hosted) |
| BYO-key metering | `x-otari-key` header on agent routes routes the call through the caller's own workspace — their budgets, their Activity view |

## Where the spend lands (2026-11-12)

Two gateways, one ledger shape. A call that carries `x-otari-key` is
metered into the agent's Otari workspace and always goes to Otari — that
is the differentiator, and it is unchanged. A call OnPoint pays for itself
now goes to Sandbase first, with Otari as the fallback on any error:
Sandbase holds the funded prepaid balance, and its `vendor/model` catalog
carries the same open-weight models we were already running. The cost
readback stays honest — Otari stamps the settled `usage.cost_usd`, and for
Sandbase the figure is computed from the per-1M-token prices published on
that model's card (`apps/api/lib/sandbase.js`), read once and cached; when
the card can't be read the call reports no cost rather than a guess. The
polaroid and `aiCost` therefore name whichever gateway actually served the
call ("Inference — $0.000712 via Sandbase").

## Where judges see it

- **Flagship paid try-on** — `POST /api/agent/try-on`: the 402 quote
  advertises `aiMetering` (header name + readback endpoint); the 200
  response and the persisted polaroid carry `aiCost`. The shareable
  polaroid page (`/p/{id}`) renders "Inference — $… via `<gateway>`"
  (Otari for a BYO-key call, Sandbase for a platform-funded one) next to
  "Paid — x cUSD / Verified on Celo": one artifact, both ledgers.
- **Agent dashboard** (`/agent`) — an "AI spend — metered by Otari"
  panel reads `/api/agent/ai-usage` live: settled cost, metered request
  count, per-model breakdown, budget-enforcement status.
- **Agent manifest** — `/.well-known/agent.json` advertises the
  `metered_agent_ai_keys` capability and an `aiMetering` block so
  agents discover the header without reading code.
- **One-command demo** — `scripts/otari-demo.mjs` walks catalog →
  ai-usage → agent call → BYO-key call → meter moved.

## Why it's a fit for the hackathon

Agent commerce is the case where model spend must be enforceable, not
advisory: a shopping agent with a payment wallet needs the same hard ceiling
on inference cost. OnPoint issues each agent an Otari key with a scoped
budget, routes its calls through it (`x-otari-key`), returns the settled
per-call cost (`aiCost`), and lets the agent read its own usage and
remaining budget back (`/api/agent/ai-usage`). The Otari Activity view is
the third-party witness for all of it.

## Repro

```bash
# usage + budget for the workspace key (or pass --key=<agent otk_>)
node --env-file=apps/api/.env scripts/otari-agent-keys.mjs usage
node --env-file=apps/api/.env scripts/otari-agent-keys.mjs budget

# per-agent key + scoped budget (needs OTARI_ADMIN_KEY / self-host master)
node scripts/otari-agent-keys.mjs provision --agent=0xAGENT --budget=5 --days=30

# agent bring-your-own key on an AI call
curl -X POST $API/api/ai/agent -H 'x-otari-key: otk_…' \
  -d '{"imageData":"data:image/jpeg;base64,…","mode":"analyze"}'
# -> response includes aiCost { provider, model, costUsd, meteredBy }

# the whole story in one script (points at api.onpoint.famile.xyz)
node --env-file=apps/api/.env scripts/otari-demo.mjs
```

## Key commits (branch `devs-wilding`)

- `b645a0a` — Otari as primary AI gateway, existing providers as ordered fallbacks
- `8a31429` — Per-agent Otari keys: BYO-key metering, budget readback, aiCost surfacing
- `b4eca51` — Otari metering in the flagship try-on flow + agent manifest
- `954afdc` — Otari in the UI: polaroid inference line + agent dashboard AI-spend panel

## Upstream

- https://github.com/mozilla-ai/otari/issues/3187 — hosted workspaces can't
  provision per-agent keys programmatically (`/keys`, `/budgets`,
  `/scoped-budgets` are master-key-only; error reads as auth failure, not
  insufficient scope). Found while building this integration.
