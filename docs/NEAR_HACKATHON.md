# NEAR HACKATHON integration plan — OnPoint

This document is the build frame of reference for adapting OnPoint to the NEAR HACKATHON. It complements `HACKATHON.md` at repo root.

## Goal
Show an AI agent paying for a fashion service (try-on/checkout) with value moving on NEAR, with a clear “do X, see Y” demo.

## Track
- Primary: **Agent Economy**
- Secondary: **Real-World Money**

## Current relevant surfaces
- Agent manifest: `/.well-known/agent.json`
- MCP/API: `apps/api` or `packages/*` (see `AGENTS.md`)
- Paid try-on: x402 flow (ADR 0012, 0018)
- Agent checkout: ADR 0010, 0017
- Agent identity: ERC-8004 on Celo (ADR 0011)
- Payouts: curator wallets (docs/ops/curator-payout-wallets.md)

## NEAR integration architecture

### Identity
- Create a NEAR named account for the OnPoint agent (e.g. `agent.onpoint.near`).
- Use a sub-account per curator or campaign if useful.
- Use function-call keys scoped to payment/checkout methods so the agent cannot drain funds.

### Payment flow
1. Agent requests `try_on` or `buy_item`.
2. Server returns a payment challenge: `quote.near` carries both a native amount (`amountNear`/`amountYocto`, priced via `NEAR_USD_PRICE`) and, when `NEAR_TOKEN_*` is configured, a token form (`token.contractId`, `token.method`, `token.amount` in the FT's base units — dollar-denominated, no rate needed).
3. Agent pays with either form:
   - native `Transfer` to the payout account (full-access key, human wallets), or
   - a **function-call access key** scoped to `escrow.onpoint.testnet::pay` — the forwarder contract (`scripts/near-spike/pay-forwarder`, raw-export Rust) releases escrowed `usdc.fakes.testnet` USDC.e to an allow-listed payee via `ft_transfer`, attaching the 1 yoctoNEAR an FCAK cannot attach itself. `pay` enforces predecessor, payee allow-list, a per-call cap (25 USDC.e), and the escrowed balance as the total budget. The policy is **owner-managed on-chain state** — `add_payee` / `remove_payee` / `set_agent` / `set_max_per_tx` / `set_owner` are gated to `onpoint.testnet` and take effect without redeploying (`get_state` exposes the live policy). The scoped key can't even reach admin methods: the FCAK allows `pay` only, so an agent attempt at `add_payee` is rejected at the access-key layer before the contract's owner check runs.
4. Server verifies the transaction trustlessly via `EXPERIMENTAL_tx_status` — auto-detects the form by tx receiver, checks signer, method, decoded args (`receiver_id` = payee, `amount` ≥ quote), finality, and receipt outcomes.
5. Server fulfills try-on/order and stores the NEAR receipt reference.
6. Curator payout is settled in the same transaction (native NEAR or the FT), or recorded `pending_reconciliation` on the platform fallback account.

### Agent price negotiation
- `POST /api/curator/{slug}/order` accepts an optional `offerUsd` — the total USD the agent offers for the order.
- The curator's floor is `commerce.priceFloorPct` of the listed total (e.g. `0.9`); absent or out-of-range → floor = posted price (no discounting, posted price only).
- Below floor → **HTTP 409** `{ code: "OFFER_BELOW_FLOOR", counterOffer: { offerUsd: <floor>, currency, listCusd, listingId, size, quantity } }` — a machine-readable counter-offer, not an error string.
- At/above floor → **HTTP 402** quote at `min(offer, list)` — a negotiated quote never exceeds the posted price. The agreed price is bound into `quoteId` (a `-o<cents>` segment), so the proof re-POST cannot be repriced and needn't repeat `offerUsd`.
- Omit `offerUsd` and the flow is byte-identical to before.
- Implemented in `apps/api/lib/agent-commerce.js` (`resolveOrderOffer`); tests in `lib/agent-commerce.test.js` + `routes/curator-storefront.negotiate.test.js`.

### Cross-chain value movement
- Use **NEAR Intents** to let an agent pay in a non-NEAR asset and settle the curator in NEAR/stablecoin.
- Use **1-Click Swap SDK** for conversion.
- Use **Chain Signatures** if the agent must authorize value on another chain.

### AI layer
- Keep existing try-on provider.
- Optionally move decisioning/fit scoring to **NEAR AI Cloud** and document it.

## Week 1 plan (integration)
- [x] Add NEAR env vars (account IDs, RPC, keys) to `apps/api/.env.example` (`NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_USD_PRICE`, `NEAR_PAYOUT_ACCOUNT`; curator override via `commerce.nearAccountId`).
- [x] Create NEAR client helper in backend/blockchain layer — `apps/api/lib/near-payments.js` (dependency-free JSON-RPC `EXPERIMENTAL_tx_status` verification).
- [x] Add NEAR payment verification endpoint or service — `verifyNearPayment()` wired into `POST /api/agent/try-on` (`nearAccountId` + `nearTxHash` rail).
- [x] Extend order/try-on records with `nearTxHash` / receipt reference — via `payments.metadata.paymentMethod: 'near'` + `metadata.near` (jsonb, no schema change; `tx_hash` stores the NEAR hash and doubles as replay guard).
- [x] Implement one successful NEAR-paid try-on — verify path proven end-to-end on testnet (`scripts/near-spike/`, tx `CBqaUzXaKr657uCKT3ZNzE36GwARk83CdAExgGqyRRJ3`); route wired, needs deployed env + live e2e.
- [x] Implement one successful NEAR-paid checkout — same rail on `POST /api/curator/{slug}/order`; `paymentMethod: 'near'`, `paymentAsset: 'NEAR'`, needs deployed env + live e2e.
- [x] Add curator payout receipt reference — per-curator `commerce.nearAccountId` pays the curator directly (payment tx = payout tx, persisted to `orders.payout_tx_hash`); platform `NEAR_PAYOUT_ACCOUNT` fallback marks payout `pending_reconciliation`. Needs a real curator account set.
- [x] Keep x402/Celo path as fallback — unchanged; NEAR is opt-in and only advertised when configured.

## Verified end-to-end (local API + testnet, 2026-11-03)

Full agent flow proven against the real API on an isolated Neon demo DB:

- `POST /api/agent/try-on` → 402 advertises `quote.paymentRails: ['celo_cusd','near']` + `quote.near` (payTo, yoctoNEAR, network); NEAR payment verified on-chain (`HDkhEiS3e18ane2Y3i2oNEWcwVVPxpDNVBjC46KfQmEK`)
- `POST /api/curator/onpoint-store/order` → 402 → pay → **201** (`f48ace39…`, `be59d2d6…`) → `payout.status: 'settled'` direct to `store.onpoint.testnet` — payment tx = payout tx (`7RSBBJ1mBptxAfrKnwU3rXh8TtGWFmY2ncKYgK1489ZH`, `2zXuvYYTH13E45BtyDyG7AH2EBGehT79N7G1d5BwtKWh`)
- Replay-safe (idempotent re-POST), atomic stock decrement, receipt `chain: 'near'` with nearblocks links (receipt page updated)
- Accounts: `onpoint.testnet` root · `agent.onpoint.testnet` (scoped, limited funds) · `curator.onpoint.testnet` · `store.onpoint.testnet` — provisioned by `scripts/near-spike/provision.mjs`
- Narrated reproducer: `scripts/near-spike/agent-demo.mjs` (API_URL-configurable, works against prod once env is deployed)

## Verified on production (api.onpoint.famile.xyz, release 20261103-132815)

- `NEAR_*` env deployed to `/opt/onpoint/shared/api/.env` on Hetzner.
- `onpoint-store` seeded in prod DB (house catalog + `near-demo-2627-home` kit + listing `0cc69356-68f1-4466-86f8-9db6b440d70a`) — the zero-curator demo path is live.
- Try-on 402 on a real listing advertises `quote.near` → `onpoint.testnet` (platform fallback).
- Order 402 on `onpoint-store` shows `payoutModel: "direct_to_curator"` → `store.onpoint.testnet`.
- **Full prod e2e:** order `b43d1860` — 4.3948 NEAR settled direct ([tx `CvvDFTqq2GB32jdXPhmSxuuUJbp9VrnguyFtKtmDjzRf`](https://testnet.nearblocks.io/txns/CvvDFTqq2GB32jdXPhmSxuuUJbp9VrnguyFtKtmDjzRf)), receipt `receipt_mw0q8w9h_498b2c1f`, curator balance 5.39 → 9.79 NEAR.
- **Re-verified 2026-11-12:** order `efdce511` — 4.9948 NEAR settled direct ([tx `8XHoihupQt526DM5CBBZsJpH7ggNJp2XRMxUH91UMfw4`](https://testnet.nearblocks.io/txns/8XHoihupQt526DM5CBBZsJpH7ggNJp2XRMxUH91UMfw4)), receipt `receipt_mwdwyst2_6d30e1c9`, curator 23.58 → 28.58 NEAR. `NEAR_USD_PRICE` refreshed 3.85 → 3.42 (fresh quote: 5.62 NEAR for the kit).
- To re-run against prod: `API_URL=https://api.onpoint.famile.xyz node agent-demo.mjs` (top up `agent.onpoint.testnet` first via `node topup.mjs` — it sends 3 NEAR/run; ~5.7 NEAR covers one full order + try-on).
- **Scoped-key stablecoin e2e (2026-11-13, release 20261113-070655):** order `7463ccce` — the agent's FCAK (`ed25519:3nqE4ACneFCmeGTvpxtDPAXJWWoMJ1i3myR79vTsjuvu`, scoped to `escrow.onpoint.testnet::pay`, zero deposit allowed) signed [tx `Le7M3xTLTrGBueXynX3UPxgtUforD3cqVN9wVLNEWSQ`](https://testnet.nearblocks.io/txns/Le7M3xTLTrGBueXynX3UPxgtUforD3cqVN9wVLNEWSQ); the forwarder released 19.23 USDC.e escrow → `store.onpoint.testnet` (escrow 19.5 → 0.27, curator 0.5 → 19.73). Receipt `receipt_mwen004p_8fae4930`. Contract deployed at `escrow.onpoint.testnet` ([deploy tx `Ha7LjRdHFvxJq5p9t1C9U9go5pcPhUHTswV5idqcK4AG`](https://testnet.nearblocks.io/txns/Ha7LjRdHFvxJq5p9t1C9U9go5pcPhUHTswV5idqcK4AG)); setup is `deploy-payforwarder.mjs` → `setup-scoped-key.mjs` (storage regs, mint, escrow top-up, key scoping — idempotent). Caveat: `usdc.fakes.testnet` is a testnet mock — same code path as mainnet USDC, not real dollars.
- **Spend-policy cap verified (2026-11-13):** redeploy with `MAX_PER_TX` = 25 USDC.e ([tx `4S7RTjMbAGxLkSEe6SKs9PQBF9epFMDJPDBYyZVEFLZS`](https://testnet.nearblocks.io/txns/4S7RTjMbAGxLkSEe6SKs9PQBF9epFMDJPDBYyZVEFLZS)). A 26 USDC.e `pay` call is rejected at the amount guard (receipt logs end at `pay: payee ok`, tx `FzXhJx6ZGmq32qaHbJsULPawjVkX9FoDMMRTv2s1ZRLm`); a 1 USDC.e call settles (`5P9vA3LB1dynUwpHXJh3tDuNGJTBUFQKZep7BY3eYp9p`). Spend authority is now bounded per-call AND by escrowed balance.
- **Owner-managed policy verified (2026-11-14):** contract v2 deployed + self-inited ([tx `CtkMBdZyXGfgx1Yud7R9FPpLoCCVanBqjD9pWn3sseqG`, init `B1ccp3DLHYyDjHkXNbpG8ukXHursvshr4RrGLnYxhDrz`](https://testnet.nearblocks.io/txns/B1ccp3DLHYyDjHkXNbpG8ukXHursvshr4RrGLnYxhDrz)). Live-policy cycle proven: owner `add_payee(agent)` (`Hv2UKoACB2PmuHdBstwhwzNycDwSfnf8yXnX3tj6WqFr`) → agent paid itself 0.5 USDC.e (`CtXhhzA2PpyEMPYjLDFKArtQV7Ee9qR9ReKZTsMZAoxP`) → owner `remove_payee` (`4wukwZyB2YbhX376RNaNSEdDQYdkafqYu61HWFPW1afR`) → the identical pay now rejected. Owner `set_max_per_tx(10)` → 15 USDC.e pay rejected → restored to 25. Bonus defense layer surfaced: the agent's `add_payee` attempt was rejected at the **key layer** ("Access key does not allow method add_payee") — policy mutation is out of reach even before contract logic runs.
- Env added to `/opt/onpoint/shared/api/.env`: `NEAR_TOKEN_CONTRACT=usdc.fakes.testnet`, `NEAR_TOKEN_FORWARDER=escrow.onpoint.testnet`, `NEAR_TOKEN_DECIMALS=6`, `NEAR_TOKEN_SYMBOL=USDC.e`. Unsetting `NEAR_TOKEN_FORWARDER` flips the quote to direct `ft_transfer` on the FT (1 yocto attach, full-access key); unsetting `NEAR_TOKEN_CONTRACT` returns the rail to native-NEAR-only.
- **Negotiate → hire → settle, two payees (local API on unreleased code + prod DB + testnet, 2026-11-14):** full `agent-demo.mjs` run — hired the `mo` stylist (try-on fee 0.05 USDC.e → `curator.onpoint.testnet`, [tx `29cHWHJmjQbR3MB9Y7KRzPP4SGyhgq49Yz6ydmur1EJK`](https://testnet.nearblocks.io/txns/29cHWHJmjQbR3MB9Y7KRzPP4SGyhgq49Yz6ydmur1EJK), render `youcam-cloth-v4`); offered `offerUsd: 17` on the kit → **409** `OFFER_BELOW_FLOOR` counter at **17.31** (`priceFloorPct 0.9` × 19.23); accepted → 402 at the agreed price (quoteId `0cc69356-M-1-o1731-…`); a 30 USDC.e `pay` call rejected on-chain (tx `B4cSCivzp2kawLB35LgDJJdXmCGky8zaiacjnusZAWMP`); order `bd78f04e` settled 17.31 USDC.e → `store.onpoint.testnet` ([tx `G1HKEc1Fe5dwQWLBTB3AfQqZi4WwrBtkmHMaN7HQBCfr`](https://testnet.nearblocks.io/txns/G1HKEc1Fe5dwQWLBTB3AfQqZi4WwrBtkmHMaN7HQBCfr)), receipt `receipt_mwepvlrq_72e7a630`. On-chain deltas: escrow 18.99→1.63, stylist 0.01→0.06 (**+0.05 earned**), merchant 20.73→38.04 (**+17.31 earned**). Two roles (service provider + merchant), two payees, one scoped key. Negotiation deployed in release `20261113-125059` — prod verified: `offerUsd: 17` → 409 counter at 17.31, accepted → 402 (`quoteId …-o1731-…`, `quote.near` → `store.onpoint.testnet`), `mo` try-on 402 → `curator.onpoint.testnet`.
- **Full narrated run on prod (2026-11-14):** `API_URL=https://api.onpoint.famile.xyz node agent-demo.mjs` — hire fee 0.03 USDC.e → `curator.onpoint.testnet` (tx `7GuhLReBvsHzU19ix35QjWMSrRQn4z31ADR7x4JoZQaH`); 30 USDC.e cap rejection (tx `9u7Txj4C6YYftGwHmHkBHxXSp9x74YCR4cmwb5wrRymi`); order `b5199664` settled 17.31 USDC.e → `store.onpoint.testnet` (tx `7vK5KoFhfkrgE1hVjdqrp2SsvqFxs6EAR5qYNGHaHR13`), receipt `receipt_mwezcf8s_31852f5f`. Deltas: escrow 20→2.66, stylist +0.03, merchant +17.31. Forwarder redeployed to match current source (tx `7Xj5Ud3wP23BryydDLVPia94nGukYizw2wf2cRPrCswt`). `RAIL=paypal` mode retained for the PayPal-hackathon demo (README documents both).

## Week 2 plan (demo + submission)
- [x] Polish one end-to-end agent purchase — `agent-demo.mjs` is the canonical run.
- [x] Add README “do X, see Y” steps.
- [ ] Record X demo video (run `agent-demo.mjs` against prod — output is video-ready).
- [ ] Publish repo and post demo.
- [ ] Submit form.
- [x] Swap picsum placeholder image for a real product photo before sharing the storefront — Venice-generated NEAR FC kit (mint/black, NEAR wordmark) now serves at `api.onpoint.famile.xyz/digital-garments/near-fc-home-kit-2627.webp` (done 2026-11-12).

## Demo script
1. `GET /api/curator/{onpoint-store,mo}/storefront` → agent finds the kit (merchant) and a try-on service (stylist).
2. `POST /api/agent/try-on` on a `mo` listing → 402 → pay the fee → `curator.onpoint.testnet` — **hire**: agent hires agent; the stylist's balance grows on-chain.
3. `POST /api/curator/onpoint-store/order` + `offerUsd` below floor → **409** machine-readable counter-offer → re-POST with the counter → **402** at the agreed price — **negotiate**.
4. Optional beat: an over-cap `pay` call is rejected on-chain — spend authority is consensus-enforced, not just policy.
5. Agent pays the agreed amount via the scoped key → re-POST `{quoteId, nearAccountId, nearTxHash}` → **201**, settled → `store.onpoint.testnet` — **settle programmatically**.
6. Before/after `ft_balance_of` on testnet: escrow down, stylist +fee, merchant +order — the provider visibly earns.

## Deployment status
- [x] `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_USD_PRICE`, `NEAR_PAYOUT_ACCOUNT` on Hetzner (`NEAR_USD_PRICE=3.42` as of 2026-11-12 — manual; refresh before recording. Env changes need `pm2 reload onpoint-api` — the serving process is id 8 on port 48751, not `onpoint-agent-server`).
- [x] `onpoint-store` seeded in prod with `commerce.nearAccountId = store.onpoint.testnet` + `commerce.priceFloorPct = 0.9` (enables order negotiation).
- [x] `mo` (prod DB) has `commerce.nearAccountId = curator.onpoint.testnet` — the stylist-service payee; already in the forwarder allow-list.
- [x] Deploy the negotiation code to prod — release `20261113-125059`, 409/402 verified live. Re-run `agent-demo.mjs` against prod for the recording (escrow is topped to ~20 USDC.e; one run needs ~17.4).
- [ ] Set `commerce.nearAccountId` on real curators as they onboard (`onpoint-store` is the always-available fallback).

## Risks and fallbacks
- If NEAR payment integration slips, keep x402/Celo working and present a recorded successful NEAR transaction.
- If cross-chain swap is too complex, demo direct NEAR payment first.
- Do not block on ChatGPT plugin approval; keep it optional.

## Submission checklist
- [ ] Repo public by Nov 14 23:59 UTC
- [ ] X demo post with video/screenshots and “built for NEAR HACKATHON”
- [ ] README setup + “do X, see Y”
- [ ] HACKATHON.md present
- [ ] NEAR account address for payout
- [ ] Form submitted once

## Narrated demo (moved from the root README)


The NEAR rail lets an agent pay for try-on/checkout and settle the curator **directly** in the same transaction. Verified end-to-end on testnet against the live API code.

```bash
cd scripts/near-spike
npm install
node provision.mjs            # creates + funds onpoint.testnet sub-accounts (~30s)
node deploy-payforwarder.mjs  # deploys the escrow forwarder to escrow.onpoint.testnet
node setup-scoped-key.mjs     # FCAK scoped to escrow::pay + tops escrow to 20 USDC.e
node agent-demo.mjs           # narrated run: discover → hire → negotiate → settle
```

What you see:

1. Two storefronts discovered — `onpoint-store` (the merchant) and `mo` (a styling service).
2. `POST /api/agent/try-on` on `mo` → **HTTP 402** → the agent pays the fee in USDC.e → `curator.onpoint.testnet`. Agent hires agent; the stylist's on-chain balance grows.
3. `POST /api/curator/onpoint-store/order` with `offerUsd` below the curator's floor → **HTTP 409** with a machine-readable `counterOffer`; re-POST at the counter → **HTTP 402** quoted at the agreed price (bound into `quoteId`).
4. An over-cap `pay` call is rejected on-chain — the scoped key can only spend what's escrowed, to allow-listed payees, bounded by the owner-set per-call cap (`get_state` on `escrow.onpoint.testnet` shows the live policy).
5. The agent pays the agreed amount → re-POST `{quoteId, nearAccountId, nearTxHash}` → **HTTP 201**, `payout.status: "settled"` → `store.onpoint.testnet`, explorer links + receipt URL.
6. Before/after `ft_balance_of`: escrow down, stylist +fee, merchant +order total — two NEAR payees, two roles, one scoped key.

API surface: `apps/api/lib/near-payments.js` (dependency-free `EXPERIMENTAL_tx_status` verification), rail wired into `routes/agent-tryon.js` and `routes/curator-storefront.js`. Config via `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_USD_PRICE`, `NEAR_PAYOUT_ACCOUNT` (see `apps/api/.env.example`); per-curator override via `commerce.nearAccountId`.
