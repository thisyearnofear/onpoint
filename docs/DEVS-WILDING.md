# OnPoint × Otari — Devs Wilding submission notes

OnPoint is the trusted execution rail for agentic fashion commerce: agents
discover inventory, pay per action (x402/cUSD on Celo, NEAR, PayPal), try on,
order, and earn — over real merchant stock. The missing rail was **AI spend**:
an agent that pays for every action also needs its model calls metered,
budget-capped, and attributable. Otari is that rail.

## Otari features used

| Otari feature | Where OnPoint uses it |
| --- | --- |
| OpenAI-compatible gateway (chat + vision) | Primary upstream for persona chat, outfit/vision analysis, look classification, garment attributes, product search — see `packages/qwen-cloud/src/otari.ts`, `apps/api/routes/ai-agent.js`, `apps/api/lib/vision.js` |
| Per-request server cost (`usage.cost_usd`) | Surfaced to callers as `aiCost` on `/api/ai/agent` responses and as `estimatedCostUsd` in `qwen-cloud` results — real settled cost, not an estimate |
| Self-serve key reads (`/key/usage/summary`, `/key/budget`) | `GET /api/agent/ai-usage` — an agent reconciles its own AI spend, the same ledger shape as its cUSD payment ledger |
| Virtual keys + scoped budgets (`/keys`, `/budgets`, `/scoped-budgets`) | `OtariAdminClient` + `scripts/otari-agent-keys.mjs provision` mints a budget-capped key per agent (`OTARI_ADMIN_KEY`, master-key only; dashboard on hosted) |
| BYO-key metering | `x-otari-key` header on agent routes routes the call through the caller's own workspace — their budgets, their Activity view |

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
```

## Key commits (branch `devs-wilding`)

- `b645a0a` — Otari as primary AI gateway, existing providers as ordered fallbacks
- `8a31429` — Per-agent Otari keys: BYO-key metering, budget readback, aiCost surfacing

## Upstream

- https://github.com/mozilla-ai/otari/issues/3187 — hosted workspaces can't
  provision per-agent keys programmatically (`/keys`, `/budgets`,
  `/scoped-budgets` are master-key-only; error reads as auth failure, not
  insufficient scope). Found while building this integration.
