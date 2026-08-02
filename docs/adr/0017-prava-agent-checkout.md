# ADR 0017: Prava Agent Checkout — Scoped-Card Cross-Merchant Purchases

**Status**: Partially implemented — live discovery and real sandbox session
creation validated; blocked before credential issuance; no merchant order completed
**Date**: 2026-08-01
**Integration**: `prava` CLI (UCP discovery) + REST `POST /v1/sessions` (payment rail)

> **Implementation outcome (updated 2026-08-02).** The integration landed as a
> **CLI + REST hybrid**, not the pure-MCP client proposed below. Discovery
> (`shop_search` → `shop_product`) shells to the `prava` CLI against production
> UCP; the payment rail runs through REST `POST /v1/sessions` (sandbox) with a
> fallback to CLI `sessions create/poll` + `shop checkout` (live). Key facts
> learned during the build:
> - **Prava's CLI has no sandbox host.** Their docs state sandbox applies only
>   to the SDK/API path, so the sandbox demo necessarily runs on REST.
> - **The real CLI's `sessions poll` returns single-use tokenized credentials**
>   (token + cryptogram + expiry), and `shop checkout` consumes those flags — it
>   does not take a `--payment-session-id`. The facade's credential handling was
>   rebuilt to match this contract (commit `1ee4d36`).
> - **Live quote requires a delivery address on file**, so the REST sandbox path
>   skips the address-gated CLI quote and uses the discovered listed price as
>   the session amount. It is not a binding merchant quote.
> - **The Linq webhook is live and verified** (Standard Webhooks signature,
>   line `+14243945528`, all events), and the Prava CLI agent is linked
>   (`aa_01KYZ4G7D34207F74VJSDKBEMM`, active).
> The original MCP-client proposal is retained below for historical context.

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
   reports the processor's actual `APPROVED`/`DECLINED` outcome via
   `report-status`. Re-poll → `completed` or `failed`.

Two integration families behave very differently around "sandbox" vs
"a completed order":

| | SDK/API (REST) | Agentic shopping (UCP + Browser Harness) |
|---|---|---|
| Flow | session → card entry → passkey → poll token → **you charge at your checkout** → report | `prava shop search → product → quote → checkout` — **Prava completes the real Shopify checkout** → `ord_…` |
| Sandbox | ✅ self-serve, no real money | ❌ CLI/MCP is **production-only**, real cards |
| OnPoint builds a PSP? | Yes — Prava sandbox cards are test credentials and do not prove a merchant charge | **No** — Prava charges the merchant itself |
| "Completed order" strength | Weak: sandbox run stops at credential + your `report-status`; no real merchant charge | **Strong**: a real order placed at a real merchant |

### The decision constraint

For a defensible hackathon submission, the headline demo must be a **real
completed order at a real merchant**, not a sandbox session that stops at
credential issuance. Prava's UCP supports real fashion brands (SKIMS, Alo
Yoga, Everlane, Glossier, Fashion Nova) — a perfect category fit for
OnPoint. The catch: UCP/CLI/MCP is **production-only with real cards**, so
the demo needs the hackathon's temporary production access (Aug 1–8,
reviewed case-by-case) and a real card for a small real charge.

## Decision (target product direction)

Build toward **OnPoint as an AI stylist agent that can fulfill a style intent
through Prava**, surfaced with a Linq iMessage App status card. The hackathon
build currently reaches live UCP discovery and real Prava sandbox-session
creation; hosted device binding blocks credential issuance before WebAuthn.

### The original insight

The target architecture fulfills one style intent across multiple merchants,
with separate scoped credentials per brand. The shipped v1 prepares one
merchant session; multi-merchant sequencing and completed orders are unshipped.

### Target architecture (not all stages shipped or validated)

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

**Integration choice: CLI for discovery + REST for payment.** UCP product
discovery (`shop_search` → `shop_product`) runs through the `prava` CLI
against production UCP (free, no payment). The payment rail has two
transports behind one facade: (a) the CLI path (`sessions create` → `poll` →
`shop checkout`) for live production with a real card, and (b) the REST SDK/API
path (`POST /v1/sessions` → `payment-result` → `report-status`) for sandbox
with a test card. Prava's CLI has **no sandbox host** (their docs: "agent-linked
payments use real cards; sandbox applies to the SDK/API path"), so the sandbox
demo necessarily runs on REST. OnPoint's backend shells to the `prava` CLI +
calls the REST API directly, and is a **Linq sender to iMessage** + the
**OnPoint try-on/styling engine**.

### Original delivery plan and current result

- **Planned must-land core**: one real completed UCP order at one fashion brand,
  flowing styling → try-on → quote → scoped-card checkout → confirmation,
  rendered as a mutating iMessage App card. Lands before any stretch work.
- **Unshipped stretch**: multi-item look across 2 merchants (2 scoped checkouts — the
  "shop across merchants" insight) + 👍-tapback group-chat voting.
- **Sandbox/demo rail (active but blocked)**: REST SDK/API session flow (`POST /v1/sessions`
  + hosted card entry + `payment-result` + `report-status`) against
  `sandbox.api.prava.space` with `sk_test_*` keys. No real money. This is the
  primary active path on production (the only path with a sandbox). Session
  creation works; device binding fails before WebAuthn and credential issuance.

### Tracks targeted

| Track | Reward | How |
|-------|--------|-----|
| Prava finalists | $10k credits | Prava IS the checkout (central) |
| Visa Intelligent Commerce | $5k cash | requested merchant/amount + documented expected controls; issuance not yet observed |
| Linq iMessage Agent | $1k + $5k credits | live send and signed webhook validated; completed mutation unobserved |
| Localhost startup-ready | $5k Anthropic | existing live product + credible continuation |
| OpenAI / Senso | (optional) | styling reasoning / verified merchant context — only if core is green |

## Consequences

### Intended benefits (not transaction evidence)

- **Clear completion target** — progress from recommendation to merchant order.
- **Differentiated insight** — try-on before requesting payment permission.
- **Trust surface** — explicit requested amount and merchant, required passkey,
  expected credential controls, and observed outcome.
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
- **Observed sandbox blocker** — Prava's hosted surface returns
  `DEVICE_BINDING_FAILED: 409` before WebAuthn across supplied/documented cards
  in Brave and Safari. Escalate with sandbox session record IDs.
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
