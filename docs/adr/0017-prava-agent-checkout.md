# ADR 0017: Prava Agent Checkout — Scoped-Card Cross-Merchant Purchases

**Status**: Proposed (hackathon build — Agentic Commerce Hackathon, Aug 1–2 2026)
**Date**: 2026-08-01
**Integration**: Prava MCP (`https://mcp.pay.prava.space/mcp`) + REST `POST /v1/sessions`

## Context

OnPoint's existing payment rails (cUSD/USDC x402 on Celo, USD₮0 on XLayer
via the OKX A2MCP facade — ADR 0016) are **crypto-native, pay-per-call**
micropayment rails: a caller pays a small fee to invoke an endpoint. They
serve try-on fees and on-chain curator checkout, but they do not let an
agent **complete a real purchase at a real merchant with a user's card.**

The [Agentic Commerce Hackathon](https://docs.prava.space) requires every
submission to use **Prava** meaningfully and centrally, and judges will
reject "a payment session alone is not a completed order" and "a mocked
payment presented as a transaction." Prava is the right tool for that bar.

### What Prava is (and is not)

Prava is **not** an x402-style pay-per-call rail and cannot be wrapped with
an OKX-style 402 facade. Prava is a **programmable card-payment proxy**:

1. Backend creates a **session** (`POST /v1/sessions`) pinning an order —
   `total_amount`, `currency`, and a `merchant_details` object that is
   explicitly *"the business the cardholder is buying from, **not your
   application**."*
2. The cardholder enters their card on **Prava's secure surface** (embedded
   iframe via `@prava-sdk/core`, or hosted redirect) and approves with a
   **passkey** (WebAuthn). New device first needs an issuer OTP (sandbox
   OTP `456789`).
3. Prava applies layered **guardrails**: owner account controls → passkey →
   mandate amount cap → 15-min session → one-time credential.
4. Prava returns a **one-time card credential** (`token` + `dynamic_cvv` +
   expiry) — single-use, **merchant-locked, amount-scoped**.
5. **The merchant charges that credential at checkout**, then the caller
   reports `APPROVED`/`DECLINED` via `report-status`. Re-poll → `completed`.

Two integration families behave very differently around "sandbox" vs
"a completed order":

| | SDK/API (REST) | Agentic shopping (UCP + Browser Harness) |
|---|---|---|
| Flow | session → card entry → passkey → poll token → **you charge at your checkout** → report | `prava shop search → product → quote → checkout` — **Prava completes the real Shopify checkout** → `ord_…` |
| Sandbox | ✅ self-serve, no real money | ❌ CLI/MCP is **production-only**, real cards |
| OnPoint builds a PSP? | Yes — and Prava sandbox test cards (`4622 9431…`) are non-standard; a test PSP (Stripe test mode) declines them | **No** — Prava charges the merchant itself |
| "Completed order" strength | Weak: sandbox run stops at credential + your `report-status`; no real merchant charge | **Strong**: a real order placed at a real merchant |

### The decision constraint

For a defensible hackathon submission, the headline demo must be a **real
completed order at a real merchant**, not a sandbox session that stops at
credential issuance. Prava's UCP supports real fashion brands (SKIMS, Alo
Yoga, Everlane, Glossier, Fashion Nova) — a perfect category fit for
OnPoint. The catch: UCP/CLI/MCP is **production-only with real cards**, so
the demo needs the hackathon's temporary production access (Aug 1–8,
reviewed case-by-case) and a real card for a small real charge.

## Decision

Build **OnPoint as an AI stylist agent that fulfills a style intent across
real fashion merchants via Prava**, surfaced as a mutating **Linq iMessage
App card**. Prava becomes the **agent checkout rail** (central, not a
bolt-on); OnPoint's existing crypto rails and inventory are disclosed as
pre-existing and untouched.

### The original insight

The agent does not buy one item — it **fulfills a style intent across
multiple merchants**, issuing a separate merchant-locked, amount-scoped
Prava credential per brand. One look → several real orders → one coherent
outcome, in a single mutating iMessage bubble. No competitor can replicate
this (they lack OnPoint's try-on + looks).

### Architecture

```
User (iMessage, via Linq number)
      │  text: "outfit me for a rooftop brunch, $120"
      ▼
OnPoint agent backend
  │  ├─ styling: compose a look from UCP brands (Alo pants + Everlane top)
  │  ├─ try-on: IDM-VTON renders the real garments on the user's photo
  │  └─ MCP client → Prava
  │        prava shop search → product → quote (per merchant)
  │        binding totals + "agent may spend up to $X, scoped per-merchant"
  ▼
Linq iMessage App card (mutates through states)
  look board → try-on render → quote+trust → checkout → confirmed order
      │
      │  passkey approval → one-time scoped credential per merchant
      ▼
prava shop checkout (per merchant, real card, production)
      │  Browser Harness completes the real Shopify checkout
      ▼
ord_abc (Alo) · ord_def (Everlane)  →  OnPoint receipt + attribution ledger
```

**Integration choice: MCP.** UCP search/quote/checkout is exposed via the
`prava` CLI / MCP (`https://mcp.pay.prava.space/mcp`), **not** the REST
API. Per Prava's decision tree, "an agent that operates through chat" → MCP.
OnPoint's backend is an **MCP client to Prava** + a **Linq sender to
iMessage** + the **OnPoint try-on/styling engine**. MCP is production-only,
which is consistent with the real-card production headline path.

### Calibrated ambition

- **Must-land core**: one real completed UCP order at one fashion brand,
  flowing styling → try-on → quote → scoped-card checkout → confirmation,
  rendered as a mutating iMessage App card. Lands before any stretch work.
- **Stretch**: multi-item look across 2 merchants (2 scoped checkouts — the
  "shop across merchants" insight) + 👍-tapback group-chat voting.
- **Fallback**: SDK/API sandbox session (`POST /v1/sessions` + `@prava-sdk/core`
  iframe + `payment-result` + `report-status`) for the live judge demo if a
  live Shopify checkout hiccups; the recorded demo video uses the real order.

### Tracks targeted

| Track | Reward | How |
|-------|--------|-----|
| Prava finalists | $10k credits | Prava IS the checkout (central) |
| Visa Intelligent Commerce | $5k cash | merchant-of-record + amount-scoped token + passkey + layered guardrails = Visa IC verbatim |
| Linq iMessage Agent | $1k + $5k credits | the iMessage App card is the entire interface |
| Localhost startup-ready | $5k Anthropic | live product + real users + distribution |
| OpenAI / Senso | (optional) | styling reasoning / verified merchant context — only if core is green |

## Consequences

### Positive

- **A real completed transaction** — the bar the brief sets and most
  competitors will miss by stopping at "payment session created."
- **Original, unreplicable insight** — try-on-before-agent-buys +
  multi-merchant scoped checkout + message-native UX.
- **Trust surface** — explicit spend ceiling, per-merchant scoping, passkey,
  receipt — tailored to the brief's "trust" and the Visa track.
- **Non-destructive** — OnPoint's cUSD/x402 + OKX rails and inventory are
  untouched and disclosed as pre-existing; Prava is a new rail, not a
  replacement.

### Negative / risks

- **Production access gating** — UCP/MCP is production-only; the headline
  demo depends on hackathon temp production access being approved. Mitigation:
  request access immediately; SDK/API sandbox fallback keeps a demo possible.
- **Real card in demo** — a small real charge per demo run. Accepted by the
  builder; only used in the recorded video + approved live demo.
- **External checkout dependency** — Browser Harness drives a live Shopify
  checkout that can change. Mitigation: recorded video for the real order;
  sandbox fallback for live judge demo.
- **UCP image → OnPoint try-on compatibility** — IDM-VTON must render a
  UCP product image on a person photo. Validate on day 1; fall back to the
  free-tier "similar style" render or skip try-on for that item if it fails.
- **Scope creep** — MCP + Linq + try-on + multi-merchant in 48h. Guard the
  single-order spine ruthlessly.

### Future work

- Bridge OnPoint's own curator physical inventory into the Prava card path
  (requires OnPoint to become a card-accepting merchant via a PSP — out of
  scope for the weekend).
- Mandates (approve once, charge within caps) for repeated try-on fees
  instead of per-call sessions.
- Recurring "style subscription" via Prava recurring mandates.

## References

- Prava docs: https://docs.prava.space/
- Prava MCP: `https://mcp.pay.prava.space/mcp`
- Prava REST: `https://sandbox.api.prava.space/v1/sessions` (sandbox) /
  `https://api.prava.space` (production)
- Prava skills: `Prava-Payments/prava-skills` (`prava-shopping`,
  `prava-sdk-integration`)
- Linq hackathon: https://linqapp.com/hackathon
- [ADR 0016: OKX A2MCP Facade](./0016-okx-a2mcp-facade.md) — the *contrast*:
  OKX is a pay-per-call x402 rail; Prava is a card-credential proxy. The OKX
  facade pattern does **not** apply to Prava.
- [AGENTS.md](../../AGENTS.md)
- Hackathon strategy note: [docs/PRAVA-HACKATHON.md](../PRAVA-HACKATHON.md)
