# ADR 0012: Celo x402 Facilitator Integration

**Status**: Accepted  
**Date**: 2026-07-13  
**Deployed**: 2026-07-14 (release 20260714-023128)

## Context

OnPoint's existing x402 payment flow uses cUSD transfers verified directly
via Forno RPC (ADR 0010). This works for the "Most Revenue Generated"
hackathon track (attribution tags on platform-initiated transactions), but
the "Most x402 Payments" track counts settlements routed through the Celo
x402 facilitator at `api.x402.celo.org`.

The Celo facilitator uses **USDC and USDT** via the gasless EIP-3009
`transferWithAuthorization` scheme — the buyer signs an off-chain
authorization, the facilitator submits it on-chain and pays the gas itself.
It does **not** support cUSD (Mento's StableTokenV2 implements only
EIP-2612 `permit`, not EIP-3009).

## Decision

Add a **parallel facilitator payment path** alongside the existing cUSD
flow. Both paths are available on the same endpoints:

1. **cUSD path** (existing): Agent transfers cUSD to `payTo`, re-POSTs
   with `paymentTxHash`. Server verifies via Forno RPC.
2. **Facilitator path** (new): Agent signs an EIP-3009
   `transferWithAuthorization` for USDC, sends the PaymentPayload in the
   `X-PAYMENT` header. Server calls the facilitator's `/verify` then
   `/settle` endpoints. The facilitator settles on-chain (gasless for
   the buyer).

### Dual-path 402 response

The 402 challenge now includes both paths:
- `accepts[]`: cUSD payment requirements (existing, x402 v1)
- `x402.accepts[]`: USDC facilitator requirements (new, x402 v2)
- `x402.facilitatorUrl`: `https://api.x402.celo.org`

Agents choose which path to use based on their capabilities.

### Endpoints affected

| Endpoint | cUSD path | Facilitator path |
|----------|-----------|-------------------|
| `POST /api/agent/try-on` | Yes (existing) | Yes (new) |
| `POST /api/curator/:slug/order` | Yes (existing) | Yes (new) |

### Implementation

- `apps/api/lib/x402-facilitator.js`: Facilitator client module with
  `buildFacilitatorRequirements()`, `verifyPayment()`, `settlePayment()`,
  and `processFacilitatorPayment()` (verify + settle in one call).
- `apps/api/routes/agent-tryon.js`: Checks `X-PAYMENT` header; if present,
  processes facilitator payment and skips cUSD verification.
- `apps/api/routes/curator-storefront.js`: Same dual-path pattern on the
  order endpoint. Curator payouts work the same way for both paths.

### Token configuration

| Token | Address | Decimals | EIP-712 |
|-------|---------|----------|---------|
| USDC | `0xcEBA9300f2b948710d2653dD7B07f33A8B32118C` | 6 | `{ name: "USDC", version: "2" }` |
| USDT | `0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e` | 6 | `{ name: "Tether USD", version: "1" }` |

USDC is the default. USDT can be requested via the `opts.asset` parameter
in `buildFacilitatorRequirements()`.

### Facilitator API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/verify` | POST | Off-chain signature + simulation check |
| `/settle` | POST | Submit authorization on-chain (facilitator pays gas) |
| `/supported` | GET | List supported `(network, scheme)` pairs |
| `/health` | GET | Liveness probe |

Base URL: `https://api.x402.celo.org` (configurable via `X402_FACILITATOR_URL`).

## Consequences

- Agents can now pay via USDC (gasless, facilitator-settled) or cUSD
  (direct transfer, self-verified) on the same endpoints.
- Facilitator-settled payments count toward the "Most x402 Payments"
  hackathon track.
- Platform-initiated curator payouts still carry the attribution tag for
  the "Most Revenue Generated" track.
- The facilitator path settles immediately — if a try-on render fails after
  settlement, the agent's payment is spent (unlike cUSD where the tx hash
  can be reused). The error response is transparent about this.
- `paymentMethod` field (`x402_facilitator` or `cusd`) is recorded in
  payments, receipts, and logs for tracking.
