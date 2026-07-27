# ADR 0016: OKX A2MCP Facade — XLayer USD₮0 Payment Bridge

**Status**: Accepted
**Date**: 2026-07-28
**Deployed**: 2026-07-28 (release 20260728-015617)
**ASP Agent ID**: 9874

## Context

OnPoint's existing x402 payment system settles in cUSD/USDC on Celo mainnet
(chainId 42220) via `api.x402.celo.org` (ADR 0012). This works for agents with
Celo wallets, but OKX.AI's Agent Service Provider marketplace requires
XLayer-native payments: `eip155:196` and USD₮0
(`0x779Ded0c9e1022225f8E0630b35a9b54bE713736`).

To list OnPoint on OKX.AI as an A2MCP (Agent-to-MCP) provider, we need
endpoints that issue x402 v2 challenges in the OKX-specific format — a
`PAYMENT-REQUIRED` response header containing a base64-encoded
`PaymentRequired` JSON object with the `exact` scheme on XLayer.

The challenge: OnPoint's try-on engine, inventory, and curator payout
system all run on Celo. We don't want to duplicate the entire backend on
XLayer. Instead, we need a **facade** that translates the payment rail
while relaying to the existing Celo backend for execution.

## Decision

Build a **hybrid x402 facade** (`apps/api/routes/okx-facade.js`) that
exposes `/okx/*` endpoints, issues XLayer USD₮0 402 challenges, and
relays to the existing Celo backend via a service-key bypass.

### Architecture

```
OKX Agentic Wallet
      │
      ▼
POST /okx/try-on  ──  402 + PAYMENT-REQUIRED header (XLayer USD₮0)
      │
      │  (payment verified by OKX facilitator)
      ▼
OKX SDK middleware (verify + settle)
      │
      ▼
relayTryOn()  ──  POST http://localhost:PORT/api/agent/try-on
      │               headers: x-service-key, x-okx-paid: 1
      ▼
Celo backend (agent-tryon.js okxBypass)
      │  skips Celo 402 + cUSD verification
      │  runs Replicate IDM-VTON try-on
      ▼
200 → SDK settles on-chain → response returned to wallet
```

### Two operating modes

The facade auto-detects OKX facilitator credentials at startup:

1. **Self-check mode** (no credentials): Hand-builds spec-compliant v2 402
   challenges in the `PAYMENT-REQUIRED` header. Passes
   `onchainos agent x402-check`. The ASP is listed and discoverable on
   OKX.AI. Live paid calls return 402 with a "facilitator not configured"
   message. This unblocks listing before OKX developer credentials are issued.

2. **Live mode** (credentials present): Uses the OKX Payment SDK
   (`@okxweb3/x402-{express,core,evm}`) for the full flow: 402 challenge →
   payment verification → on-chain settlement → handler replay. The SDK's
   `paymentMiddleware` gates the route, verifies the payment signature via
   the OKX facilitator, runs the handler, then settles on-chain.

### Service-key bypass

The Celo backend (`agent-tryon.js`) was modified to skip its own 402 + cUSD
verification when `x-okx-paid: 1` and a valid `x-service-key` header are
present. In this bypass path:
- Payment method is recorded as `okx_facade` in the ledger
- The normal try-on pipeline runs (Replicate IDM-VTON, fit signal, polaroid)
- Curator revenue attribution still flows through the Celo payout system

This means the OKX payment (USD₮0 on XLayer) and the Celo curator payout
(cUSD on Celo) are decoupled — the platform absorbs the cross-chain
settlement gap. Future work may bridge OKX revenue to Celo for curator
payouts.

### Registered services

| Service | Endpoint | Fee | x402 |
|---------|----------|-----|------|
| Browse Curator Directory | `POST /okx/browse` | $0 (free) | Zero-fee 402 (amount=0) |
| Virtual Try-On | `POST /okx/try-on` | $0.05 | Paid 402 (amount=50000 atomic) |

Both use `scheme: exact`, `network: eip155:196`, `asset: USD₮0`.

### Key technical details

- **USD₮0 decimals**: 6 (included in `extra.decimals` so the OKX validator
  can resolve `amountHuman` — USD₮0 is not in OKX's known token list yet)
- **payTo**: `0x5e32740122999bb98a50055d68593f94d2a0711e` (OnPoint's XLayer
  wallet, derived from the OKX Agentic Wallet)
- **402 format**: `PAYMENT-REQUIRED` header is base64-encoded JSON with
  `x402Version: 2`, `resource`, and `accepts[]`
- **SDK**: `@okxweb3/x402-express@0.1.1`, `@okxweb3/x402-core@0.1.0`,
  `@okxweb3/x402-evm@0.2.1` — installed as production dependencies

## Consequences

### Positive

- **OKX.AI marketplace presence**: OnPoint is discoverable by any OKX
  Agentic Wallet user — a large audience of funded agents
- **No backend duplication**: The facade is a thin relay; all try-on logic,
  inventory, and curator data stay on Celo
- **Self-check unblocks listing**: The ASP can be registered and listed
  before OKX developer credentials are issued
- **Clean mode switching**: Adding `OKX_API_KEY`/`OKX_SECRET_KEY`/
  `OKX_PASSPHRASE` env vars + reload flips from self-check to live
- **Zero-fee browse**: The free directory service is still x402-gated
  (required by OKX A2MCP spec) but costs nothing to call

### Negative

- **Cross-chain settlement gap**: OKX payments land in USD₮0 on XLayer;
  curator payouts happen in cUSD on Celo. The platform must bridge or
  absorb this gap until a cross-chain settlement path is built
- **Additional env vars**: Three OKX credentials + `OKX_PAY_TO_ADDRESS` +
  `OKX_FACADE_PUBLIC_URL` must be managed on the server
- **SDK dependency**: Three `@okxweb3/*` packages added to production deps
- **Two 402 formats**: Celo endpoints use the existing 402 body format;
  OKX endpoints use the `PAYMENT-REQUIRED` header format. Agents must
  handle both depending on which endpoint they hit

### Future work

- Bridge OKX USD₮0 revenue to Celo for curator payouts (or track as
  platform revenue and settle separately)
- Add `/okx/order` endpoint for physical purchases via the OKX facade
- Explore OKX's `upto` scheme for variable-amount services
- Monitor OKX token list updates — if USD₮0 is added, the `decimals` extra
  field can be removed

## References

- [AGENTS.md — OKX.AI Marketplace section](../../AGENTS.md#okxai-marketplace-a2mcp-facade)
- [OKX facade route](../../apps/api/routes/okx-facade.js)
- [agent-tryon.js service-key bypass](../../apps/api/routes/agent-tryon.js)
- [ADR 0012: Celo x402 Facilitator Integration](./0012-x402-facilitator-integration.md)
- [ADR 0013: Pricing Strategy](./0013-pricing-strategy-and-agent-revenue-model.md)
- OKX SDK: `@okxweb3/x402-{express,core,evm}` on npm
- OKX facilitator: `https://web3.okx.com/api/v6/pay/x402`
