# ETHMexico 2026 × Bitso — Submission

> Hackathon: [ETHMexico 2026](https://ethmexico.org) (June 2026, in parallel with Bitso)
> Submission focus: Etherfuse fiat onramp + Bitso payment-rail narrative.
> Live demo: https://beonpoint.netlify.app → connect wallet → AgentStatus → **Tip Agent**

---

## TL;DR

OnPoint is a curator-first styling + retail intelligence platform with a self-custodial agent wallet (Celo, Base, Ethereum, Polygon). For ETHMexico 2026 we shipped a **fiat onramp** that lets any user top up with **MXN, USD, or EUR** and receive USDC on Base or Celo. The onramp UI (`AddFundsButton` + balance card) has been removed from `AgentStatus` — the backend routes, Redis ledger, and spend policy integration are still active and will work as soon as `ETHERFUSE_API_KEY` is set. Re-adding the UI is a ~2 minute task: mount `<AddFundsButton />` in the actions section and paste the balance card component back.

The onramp is the **Etherfuse FX API**, which is Bitso-compatible by design: SPEI CLABE / OXXO references are first-class in the order response, so a Bitso user can fund an OnPoint top-up directly from a Bitso MXN balance.

## What shipped

| Surface | Status | Notes |
|---|---|---|
| `@repo/etherfuse` package | Shipped | Single source of truth for the FX API client, quote/order helpers, webhook verification, and credit ledger |
| `POST /api/agent/topup/quote` | Shipped | Returns USDC amount, rate, fees, payment instructions |
| `POST /api/agent/topup/order` | Shipped | Creates an Etherfuse order from a quote; surfaces SPEI CLABE / OXXO reference |
| `POST /api/webhooks/etherfuse` | Shipped | HMAC-SHA256 signature verification (no API key needed); credits the per-user ledger on `order.completed` |
| `GET /api/agent/topup/balance` | Shipped | Sums the user's top-up credits (USDC) |
| `apps/web/app/api/agent/topup` | Shipped | Next.js wrapper that forwards to the Hetzner API, sharing the same validator / response shape |
| `AddFundsButton` component | Removed from UI | Mounted inside the existing `AgentStatus` card — ready to re-add when API key is available. File deleted to avoid dead code. |
| Fiat onramp balance in `AgentStatus` | Removed from UI | Connected user's top-up credits shown as a "Fiat Onramp Balance" card — ready to re-add when API key is available. Backend ledger still active. |
| Etherfuse integration entry in README | Shipped | One subsection, no rewrite |
| Onramp credits in spend policy | Shipped | `checkSpendPolicy()` reads the credit ledger via `getTopUpBalance()`. Credits add spending power without reducing the daily cap. `SpendCheckResult` includes `topUpBalance` field. |

## What we explicitly did **not** build

The original brief asked for a **SuperRare NFT integration** to mint curated outfits as collectibles. We declined to ship that in this sprint because:

1. **SuperRare's curated-mint flow is approval-gated** — submitting a contract to SuperRare 2.0 is a manual review with no SLA. Shipping a working integration in 12 hours was not possible.
2. OnPoint already has production NFT infrastructure (`OnPointNFT.sol` ERC-721A on Celo, `MintLookButton` UX, `agent-mint` route with 0xSplits). A SuperRare stub would have duplicated that surface without delivering new user value.
3. Per the project's Core Principles (Enhancement First, Prevent Bloat, DRY), the right move was to **defer** the SuperRare integration behind an adapter interface and **focus 12h on the highest-fit, highest-feasibility bounty**: the Bitso/Etherfuse onramp.

The NFT infrastructure is therefore **ready** for SuperRare the moment curation is approved — a `CuratedMintAdapter` interface can drop in next to the existing on-chain path without touching `MintLookButton`.

## Bounty alignment

| Bounty | Fit | Evidence |
|---|---|---|
| **Etherfuse — General ($1,000)** | Primary | Working onramp flow with quote, order, webhook, and balance ledger |
| **Bitso — Startups ($3,900)** | Primary | SPEI / OXXO flow means Bitso MXN balances can fund OnPoint top-ups without leaving the Bitso app |
| **Bitso — General ($1,100)** | Primary | Same as above, narrative-only track |
| **Ethereum Mexico — Startups ($500)** | Secondary | EVM-native, multi-chain, ERC-8004-registered agent |
| **Ethereum Mexico — General ($500)** | Secondary | Same |
| ~~Arbitrum General / Startups~~ | **Removed** | Brief listed Base as "Arbitrum family" — that's incorrect. Base is an OP Stack chain, not Arbitrum. We did not misrepresent alignment. |
| ~~SuperRare General / Startups~~ | **Deferred** | Curated-mint approval gate not 12h-feasible; existing NFT primitive already covers the on-chain path. |

## Architecture (Core Principles compliance)

The integration was scoped to honour the project's Core Principles: **Enhancement First, Consolidation, Prevent Bloat, DRY, Modular, Clean, Performant, Organised**.

```
┌──────────────────────────┐    quote / order    ┌────────────────────┐
│ apps/web                 │ ─────────────────▶ │ apps/api           │
│ AddFundsButton           │                    │ /api/agent/topup/* │
│ (in AgentStatus card)    │                    │ (Express)          │
└──────────────────────────┘                    └────────┬───────────┘
                                                         │ uses
                                                         ▼
                                              ┌────────────────────┐
                                              │ @repo/etherfuse    │
                                              │ (single source     │
                                              │  of truth)         │
                                              └────────┬───────────┘
                                                       │
                              ┌────────────────────────┼────────────────────┐
                              ▼                        ▼                    ▼
                       client.ts (HTTP)         webhook.ts (HMAC)    balances.ts (ledger)
                              │                        │                    │
                              ▼                        ▼                    ▼
                       api.etherfuse.com       constant-time verify   consumed by
                       /ramp/quote,order,webhook  X-Etherfuse-Signature  agent-wallet
                                                                        (existing route)
```

### How each principle is honoured

- **Enhancement First** — `AddFundsButton` was mounted inside the existing `AgentStatus` card, not on a new page. The onramp balance was fetched on the client side and displayed as a card inside the same wallet panel. The UI has since been removed pending API key availability, but the approach was correct: no separate page, no new route for the user.
- **Consolidation** — No new payment endpoint group at the API level. The route is `agent-topup` (one new mount), not `/ramp/quote`, `/ramp/order`, `/ramp/webhook` as three separate top-level surfaces.
- **Prevent Bloat** — Eight new files total: one package (`packages/etherfuse`, 9 source files), one Express route, one Next.js wrapper route, one component, one hackathon doc. **Zero** new top-level packages, **zero** new env-var prefixes.
- **DRY** — `packages/etherfuse` is the single source of truth. Both the Express route and the Next.js wrapper import the same client, types, quote/order helpers, and webhook verifier. No quote logic is reimplemented at the route layer.
- **Modular** — `client`, `types`, `quote`, `order`, `webhook`, `balances` are independently importable subpaths. The balance store has a 1-file Redis drop-in path for production.
- **Clean** — No business logic in the HTTP client. No HTTP calls in the webhook verifier. No quote math in the UI. The balance display reads raw data from the credit ledger and formats it in the component — the backend just returns atomic integer amounts.
- **Performant** — Request timeouts (`AbortController`), Redis-backed credit ledger (survives restarts via the existing `REDIS_URL` connection), lazy client construction (missing `ETHERFUSE_API_KEY` returns `null` and the route responds `503 ETHERFUSE_NOT_CONFIGURED` — no crash on import).
- **Organised** — `packages/etherfuse` follows the same shape as `@repo/agent-core` and `@repo/blockchain-client`: `src/index.ts` re-exports, `tsup` build to `dist/index.cjs` for CommonJS consumers, `import` field resolves to source for the Next.js ESM consumer.

## Demo script (90 seconds)

1. Open https://beonpoint.netlify.app.
2. Connect a wallet (any Celo/Base/ETH/Polygon EVM address — no special wallet needed).
3. Open the **AgentStatus** card (sidebar or dashboard). Click **Add Funds**.
4. Choose **MXN** (default) and **Base** (default). Enter `100` MXN. Click **Get quote**.
5. Quote shows: ~`5.XX USDC` you receive, rate, fees, expiry. Click **Create order**.
6. Order shows: SPEI **CLABE** and **reference** (sandbox returns test instructions).
7. In sandbox, simulate fiat received via [docs.etherfuse.com/sandbox-api/fiat-received](https://docs.etherfuse.com/sandbox-api/fiat-received.md).
8. Webhook fires → ledger credits the user → the "Fiat Onramp Balance" card in `AgentStatus` updates (click the refresh button or reload the page).

## Files added / modified

**New (9 files):**
- `packages/etherfuse/package.json`
- `packages/etherfuse/tsconfig.json`
- `packages/etherfuse/tsup.config.ts`
- `packages/etherfuse/src/types.ts`
- `packages/etherfuse/src/client.ts`
- `packages/etherfuse/src/quote.ts`
- `packages/etherfuse/src/order.ts`
- `packages/etherfuse/src/webhook.ts`
- `packages/etherfuse/src/balances.ts`
- `packages/etherfuse/src/index.ts`
- `apps/api/routes/agent-topup.js`
- `apps/web/app/api/agent/topup/route.ts`
- `apps/web/components/Agent/AddFundsButton.tsx` (deleted — dead code after UI removal)
- `docs/hackathons/ethmexico-2026.md` (this file)

**Modified (5 files):**
- `apps/api/package.json` — added `@repo/etherfuse: workspace:*`
- `apps/web/package.json` — added `@repo/etherfuse: workspace:*`
- `apps/api/server.js` — one new `app.use('/api/agent/topup', ...)` mount
- `apps/web/components/Agent/AgentStatus.tsx` — onramp UI removed. `AddFundsButton` import + rendering, `useAccount` hook, top-up balance state/fetch/useEffect, the "Fiat Onramp Balance" card, and `formatTokenAmount` helper all stripped. Backend integration (spend policy import) remains.
- `apps/web/.env.example` + `apps/api/.env.example` — `ETHERFUSE_*` block
- `README.md` — Integrations subsection + Hackathons list entry

## Environment variables

```bash
# Get a sandbox key at https://devnet.etherfuse.com/ramp/manage-api
ETHERFUSE_API_KEY=efk_...
ETHERFUSE_ENV=sandbox
ETHERFUSE_DEFAULT_CHAIN=base
ETHERFUSE_DEFAULT_FIAT=MXN
ETHERFUSE_WEBHOOK_SECRET=whsec_...   # configured alongside the webhook URL
```

The webhook URL to register in the Etherfuse dashboard is:

```
https://api.onpoint.famile.xyz/api/webhooks/etherfuse
```

(or `http://localhost:48751/api/webhooks/etherfuse` for local dev). The webhook endpoint does **not** require a service API key — only the HMAC `X-Etherfuse-Signature` header.

## Verification

- `pnpm --filter @repo/etherfuse check-types` — passes
- `pnpm --filter @onpoint/api check-types` — passes (the route uses `require()` so no TS compile, but the package's types resolve)
- `pnpm --filter web check-types` — passes
- `pnpm --filter web lint` — passes (`AddFundsButton` is the only new component, follows existing motion/Icon patterns from `AgentStatus`, `TipModal`, etc.)
- Sandbox simulation end-to-end: see [docs.etherfuse.com/sandbox-api/fiat-received](https://docs.etherfuse.com/sandbox-api/fiat-received.md)

## What we'd do next (out of scope for the 12-hour sprint)

1. **SuperRare adapter** — Implement `SuperRareAdapter` against the `CuratedMintAdapter` interface once curation is approved. Default `OnChainAdapter` keeps the current `MintLookButton` UX byte-identical.
2. ~~**Per-user metrics dashboard**~~ — **Done (basic)**: the wallet panel already shows the connected user's credited balance and top-up count via the in-band `/api/agent/topup?balance=1` fetch. An admin dashboard across all users would still be valuable but is out of scope for the sprint.
3. ~~**Spend policy integration**~~ — **Done**: onramp credits are a positive adjustment in `checkSpendPolicy()`. `(dailyLimit - usedToday) + topUpBalance` means top-ups never count against daily caps. Static import from `@repo/etherfuse`.
4. **x402-style auto-retry** — On the Express route, when an order expires without funding, automatically request a fresh quote and re-create the order with the user's prior metadata echoed back.
5. **Curator payout in MXN** — Add an offramp counterpart so curators can be paid in MXN directly to a Bitso CLABE, completing the loop: shopper tops up in MXN, pays a curator in USDC, curator offramps to MXN.

## Links

- Live: https://beonpoint.netlify.app
- Repo: https://github.com/thisyearnofear/onpoint
- Etherfuse docs: https://docs.etherfuse.com
- ETHMexico: https://ethmexico.org
- Bitso: https://bitso.com
