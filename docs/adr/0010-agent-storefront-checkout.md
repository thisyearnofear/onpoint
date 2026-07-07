# ADR 0010: Agent Storefront Checkout — external agents buy, curators earn on-chain

**Status:** Accepted
**Date:** 2026-07-07

## Context

OnPoint's agent commerce was self-referential: our own agent, our own wallet,
our own receipts, buying from a static demo catalog (`CANVAS_ITEMS`) with the
platform as sole seller. Curator listings — the real inventory — were not
purchasable by agents, and no flow paid a curator anything. Grant reviewers
(Prezenti Frontier, June 2026) called this out precisely: registration plus
memo-style receipts is not third-party usage.

## Decision

Every curator storefront is two storefronts sharing one inventory:
the HTML one for humans, and a machine-readable one for agents.

### Discovery → purchase flow (external agent, its own wallet)

1. `GET /api/curator/directory` — curators flagged `agentCommerceEnabled`
2. `GET /api/curator/:slug/storefront` — listings carry `agentCommerce.offers`
   (size, stock, `priceKes`, `priceCusd`)
3. `POST /api/curator/:slug/order` `{listingId, size, quantity}` →
   **HTTP 402** with x402 `PaymentRequirements` + a human-readable quote
4. Agent transfers the exact cUSD to `payTo` (platform wallet) on Celo mainnet
5. Re-`POST` with `{paymentTxHash}` → server verifies the transfer on-chain
   (`ERC20.verifyTransfer`: receipt success, cUSD Transfer log to payTo,
   amount ≥ required), then:
   - claims the tx hash atomically (`orders.payment_tx_hash UNIQUE` — replay
     and double-payout safe)
   - pays the curator their share in cUSD to `commerce.walletAddress`
     (`calculateSplit` with `sellerBps = (1 − revShare) × 10000`)
   - decrements stock, records a `purchase` receipt anchored to the buyer's tx
   - returns **201** with Celoscan links for both payment and payout

Advertised to agents via the `commerce` block in `/.well-known/agent.json`.
Reference implementation: `scripts/agent-buyer.mjs` (also the e2e test).

### Design choices

- **Payment proof over facilitator.** The agent pays directly and presents the
  tx hash; we verify against Forno ourselves. No x402 facilitator dependency,
  fully deterministic, works for any wallet that can send an ERC-20 transfer.
- **Curator wallet = `commerce.walletAddress`** — the field already used for
  G$ streaming (DRY; no schema change to curators). No wallet → listing is
  browsable but not agent-purchasable (409 on order).
- **`revShare` is the platform's fraction** (set to 0.05 at onboarding), so
  curators keep 95% minus reserved affiliate/agent tiers.
- **Mainnet is the default everywhere.** `X402_NETWORK=celo-alfajores` is an
  explicit opt-in; testnet is never inferred from `NODE_ENV`
  (`@onpoint/shared-types/x402`).
- **Prices are KES-native**, converted at quote time via `KES_PER_USD`
  (env, default 130) in `apps/api/lib/agent-commerce.js`.

## Consequences

- Every agent purchase produces two verifiable mainnet transactions — buyer
  payment in, curator payout out — reconciled in the `orders` table
  (`amount_cusd`, `buyer_address`, `payment_tx_hash`, `payout_tx_hash`).
- Curators need a Celo wallet (MiniPay works) to earn from agents; the
  onboarding form and `POST /api/curator/apply` accept `walletAddress`.
- Deploy requires the additive migration
  `packages/db/drizzle/0001_sparkling_archangel.sql` and `AGENT_PRIVATE_KEY`
  (or signer) on the API host for payouts.
