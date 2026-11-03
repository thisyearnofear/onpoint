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
2. Server returns a payment challenge referencing a NEAR transaction/payment request.
3. Agent signs/pays using its function-call key or via NEAR Intent.
4. Server verifies the NEAR transaction/receipt.
5. Server fulfills try-on/order and stores the NEAR receipt reference.
6. Curator payout is recorded/settled in NEAR or stablecoin.

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

## Week 2 plan (demo + submission)
- [x] Polish one end-to-end agent purchase — `agent-demo.mjs` is the canonical run.
- [x] Add README “do X, see Y” steps.
- [ ] Record X demo video (run `agent-demo.mjs` against deployed API).
- [ ] Publish repo and post demo.
- [ ] Submit form.

## Demo script
1. `GET /api/curator/onpoint-store/storefront` → agent sees a payable offer.
2. `POST /api/agent/try-on` → 402 with `quote.near` rail.
3. Agent pays on NEAR testnet → server verifies on-chain.
4. `POST /api/curator/onpoint-store/order` + `nearTxHash` → 201, order confirmed.
5. Curator balance on-chain → settled in the same tx; receipt + explorer links.

## Remaining deployment steps
- Copy `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_USD_PRICE`, `NEAR_PAYOUT_ACCOUNT` into Hetzner `apps/api/.env`.
- Set `commerce.nearAccountId` on real curators as they onboard (`onpoint-store` is the always-available fallback).

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
