# HACKATHON.md — NEAR HACKATHON (Nov 1–14, 2026)

> Project: **OnPoint — Agentic Fashion Commerce**
> Track: **Agent Economy** (secondary: **Real-World Money**)
> Repo: https://github.com/thisyearnofear/onpoint
> Live: https://onpoint.trustfall.xyz

Other hackathon lanes: [`docs/WIF_HACKATHON.md`](docs/WIF_HACKATHON.md)
(Robinhood Chain, closes Nov 12) · [`docs/PAYPAL_HACKATHON.md`](docs/PAYPAL_HACKATHON.md)
(live-validated) · [`docs/SWITCH_HACKATHON.md`](docs/SWITCH_HACKATHON.md) ·
[`docs/NEAR_HACKATHON.md`](docs/NEAR_HACKATHON.md) (integration detail).

## 1. Event essentials
- Build window: **Nov 1 00:00 UTC → Nov 14 23:59 UTC, 2026**.
- Judging: Nov 16–18; results by Nov 18 23:59 UTC.
- Submission requires: public repo + public demo post on X (video/screenshots), plus form with project name, description (20–2000 chars), team lead/email/size, preferred track, NEAR account address for payout, repo link, demo link.
- One submission per team; cannot be edited after sending.
- README must make it easy for judges to run the prototype with “do X, see Y” steps.

## 2. Why OnPoint is a strong NEAR candidate
OnPoint already turns live fashion inventory into **fit-aware, machine-readable, locally payable offers** for both humans and agents. It has:
- `/.well-known/agent.json` manifest
- x402 paid try-on and checkout
- ERC-8004 agent identity on Celo
- MCP tools for third-party agents
- Curator storefronts and payouts

The NEAR story is direct: **an AI agent pays for a service (try-on/checkout) and value moves across chains to the curator.**

## 3. NEAR tools in the build

**Built and verifiable in the repo:**

- **Named accounts + sub-account tree** — `onpoint.testnet` → `agent.onpoint.testnet` (scoped agent wallet, limited funds), `store.onpoint.testnet` (curator payout). Human-readable identities a judge can inspect on nearblocks.
- **Direct-to-curator settlement** — the agent's payment tx *is* the payout tx: the transfer lands on the curator's account in the same transaction the API verifies. No platform custody step.
- **Trustless on-chain verification** — the server never trusts the client-supplied hash: `apps/api/lib/near-payments.js` re-reads the transaction via raw JSON-RPC (`EXPERIMENTAL_tx_status`) and checks signer, receiver, amount, and finality before fulfilling.
- **Function-call access key + escrow forwarder (stablecoin settlement)** — the agent's demo payment is signed by a function-call access key scoped to exactly one method: `pay` on `escrow.onpoint.testnet`, a ~60-line Rust forwarder contract (`scripts/near-spike/pay-forwarder`). FCAKs can't attach the 1 yoctoNEAR `ft_transfer` requires, so the forwarder holds the agent's escrowed `USDC.e` (`usdc.fakes.testnet`) and releases it only to allow-listed payees, capped at 25 USDC.e per call and bounded by the escrowed balance — spend authority enforced by consensus, not the API. Verified e2e: order `7463ccce`, tx `Le7M3xTLTrGBueXynX3UPxgtUforD3cqVN9wVLNEWSQ` settled 19.23 USDC.e escrow → `store.onpoint.testnet`. Token mode is env-gated (`NEAR_TOKEN_*`); native NEAR stays as the fallback rail.
- **Programmable spend scoping** — the agent pays from `agent.onpoint.testnet`, a sub-account holding only a demo balance: the blast radius of a leaked agent key is the wallet, not the platform.
- **Multi-rail 402 quoting** — the same offer advertises `celo_cusd`, `near`, and `paypal`; the agent chooses, and NEAR is the rail it can complete with zero human in the loop. The `near` quote itself carries both native NEAR (`amountNear`) and token (`token.method` on `token.contractId`) forms.

**Documented next steps (not in the build — listed so judges can find the seam):**
- **NEAR Intents / 1-Click Swap** — the USD→asset conversion seam (`NEAR_USD_PRICE` / token pricing in `near-payments.js` is the placeholder). An intent would let the agent pay in any asset and settle the curator in their preferred one.
- **Chain Signatures** — for the agent to authorize value on other chains without holding root keys.
- **NEAR AI Cloud** — optional fit/try-on inference or agent decisioning.
- **Meta-transactions** — a relayer could cover the agent's gas so it holds only spend authority.


## 4. Minimum viable win (2 weeks)
Scope to **one curator, one item, one agent flow**.

**Zero-curator fallback:** the platform-operated `onpoint-store` storefront guarantees demo inventory regardless of curator onboarding — a house catalog whose NEAR payouts land on `store.onpoint.testnet`. Real curators are a bonus, not a blocker.

Current state (implemented): NEAR payment rail on `POST /api/agent/try-on` and `POST /api/curator/{slug}/order` — `nearTxHash` proof (`nearAccountId` optional — the payer is derived from `transaction.signer_id`), trustless JSON-RPC verification (`apps/api/lib/near-payments.js`), direct-to-curator settlement. Reproduce locally: `cd scripts/near-spike && npm i && node provision.mjs && node agent-demo.mjs` (narrated end-to-end run, ~2 min). Spike databases live in `scripts/near-spike`'s own env — never repoint `apps/api/.env`'s `NEON_DATABASE_URL` at a demo project (the 2026-11-03 incident: the near-demo DB went stale against prod migrations and every artifact route 500'd locally).

**Verified live on prod (2026-11-06):** `API_URL=https://api.onpoint.famile.xyz node agent-demo.mjs` ran the full arc against production — storefront discovery → HTTP 402 with `quote.near` (direct_to_curator) → real testnet transfer → HTTP 201 + receipt.

**Verified live on prod (2026-11-13, scoped-key stablecoin path):** same demo, token form — FCAK-signed `pay` on `escrow.onpoint.testnet` → cross-contract `ft_transfer` → 19.23 USDC.e escrow → `store.onpoint.testnet`; order `7463ccce` (tx `Le7M3xTLTrGBueXynX3UPxgtUforD3cqVN9wVLNEWSQ`, receipt `receipt_mwen004p_8fae4930`). Reproduce: `node deploy-payforwarder.mjs && node setup-scoped-key.mjs && node agent-demo.mjs` (wasm rebuild needs `cargo build --target wasm32-unknown-unknown --release` in `pay-forwarder/`). Separately, a paid try-on (`agent.onpoint.testnet` → `store.onpoint.testnet`, 0.00779 NEAR) returned a live render with `provider: youcam-cloth-v4` (image-conditioned, 12.3s) — the premium render stage and the NEAR rail proven together end-to-end. Human front door at `onpoint.trustfall.xyz/pay` — the same 402 → pay → verify flow rendered for a wallet user (MyNearWallet redirect, QR send page, hash-only verify). Render chain: youcam → replicate → gemini → neon-image → venice; free tier stays venice-first by design.

1. Agent discovers item via manifest/API.
2. Agent requests paid try-on.
3. Agent pays on NEAR (or via NEAR Intent from another asset).
4. Agent receives try-on result + on-chain receipt.
5. Agent completes checkout.
6. Curator receives NEAR/stablecoin payout + receipt.

Out of scope for the hackathon: ChatGPT plugin directory approval, multi-curator scale, full M-Pesa production rollout.

## 5. Integration plan

### Week 1 — NEAR payment rail
- Add NEAR account/config for agent treasury and curator payout.
- Implement NEAR payment challenge/response alongside existing x402 flow.
- Record on-chain receipt reference in order/try-on records.
- Add 1-Click Swap path for asset conversion.
- Keep Celo/x402 path working as fallback.

### Week 2 — demo + submission
- Polish one end-to-end agent purchase.
- Add “do X, see Y” README steps.
- Record 60–90s X demo video.
- Publish repo + X post.
- Submit form.

## 6. Demo script (do X, see Y)
1. Open `/.well-known/agent.json` → see payable try-on/checkout offer.
2. Agent calls `try_on` → sees payment challenge.
3. Agent pays on NEAR → sees transaction receipt + try-on result.
4. Agent calls `buy_item` → sees order confirmation.
5. Curator dashboard/wallet → sees NEAR payout + receipt.

## 7. Risks and fallbacks
- **Risk:** NEAR payment integration slips.
  **Fallback:** keep x402/Celo checkout working and present NEAR as the primary showcased rail with a recorded successful NEAR transaction.
- **Risk:** scope creep into plugin packaging.
  **Fallback:** plugin stays optional; core is NEAR checkout.
- **Risk:** cross-chain swap complexity.
  **Fallback:** demo agent pays directly in NEAR first; add swap as enhancement.

**Three rails now live on the same offer (2026-11-12):** `quote.paymentRails: ["celo_cusd","near","paypal"]`. NEAR stays the showcased rail — it is the only one an agent settles alone, trustlessly verified server-side against JSON-RPC — and PayPal is the contrast case that proves the point: an agent that can pay without a human *should not always*. Say both; the comparison is what makes the NEAR property legible.

**Order of submission matters.** The PayPal AI Hackathon closed 12 Nov 20:00 UTC — OnPoint was submitted there as [onpoint-b3dory](https://devpost.com/software/onpoint-b3dory) ([docs/PAYPAL_HACKATHON.md](./docs/PAYPAL_HACKATHON.md)). The NEAR form locks on send; it can now describe three working rails instead of one.

## 8. Submission checklist
- [ ] Repo public by Nov 14 23:59 UTC
- [ ] X demo post with video/screenshots and “built for NEAR HACKATHON”
- [ ] README has setup + “do X, see Y” steps
- [ ] HACKATHON.md present
- [ ] NEAR account address for prize payout
- [ ] Form submitted once, details double-checked
- [ ] Everything shown in the video exists on the **deployed** hosts — `apps/web` was 105 commits ahead of prod on 2026-11-12; check before recording ([deployment rule](docs/ops/deployment.md))

## 9. Related docs
- Agent commerce guide: `docs/guides/agent-commerce.md`
- Architecture: `docs/ARCHITECTURE.md`
- Strategy: `docs/STRATEGY.md`
- NEAR integration details: `docs/NEAR_HACKATHON.md`
