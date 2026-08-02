# Prava Demo Video — Narration Script

Record with `node scripts/prava-demo.mjs` (self-check) or `--live` + `LINQ_DEMO_TO`.
Target length: ~100 seconds. Pick **Variant A** if production access landed and a
real merchant order completed; **Variant B** only if the real Prava sandbox
lifecycle reached `completed`; otherwise use **Variant C**. Never mix claims.

## Recording rules (both variants)

- Rehearse the whole run in self-check mode first (free). Sandbox card allows
  **30 transactions/day** — batch all real transactions into one take.
- **Never show** API keys, the sandbox card number/CVV, or `PRAVA_*`/`LINQ_*` env
  values. Crop or blur the passkey/payment surface when recording Step 5.
- Show the trust block (spend ceiling, merchant scope, guardrails) prominently at
  Steps 3–4 — the Visa judges score controls explicitly.
- Show the 👍 tapback → card flip only if it was observed against a completed
  Prava lifecycle; otherwise show the implemented state card and label it so.
- Phone screen recordings should be clean; no notifications enabled.

---

## Variant A — production access granted, real order completed

> **(0:00 — demo banner)** "Most AI shopping stops at a recommendation. This is
> OnPoint: an agent that discovers fashion, tries it on *you*, and completes the
> purchase — with Prava as the payments and trust layer."
>
> **(0:12 — Step 1, Discover)** "A user texts a style intent. The agent searches
> real fashion merchants through Prava's universal catalog protocol — live SKUs,
> live prices."
>
> **(0:24 — Step 2, Try-on)** "Before any money moves, it renders the actual
> garment on the user's photo. Fit first, buy second."
>
> **(0:36 — Steps 3+4, Quote & Authorize)** "The agent locks a binding quote and
> opens a Prava payment session. Note the trust block: spend ceiling, merchant
> scope, single-use credential. The user's card is never exposed to the agent."
>
> **(0:52 — Step 5, Approve)** "The user approves with a passkey on the iMessage
> card. Prava mints a one-time credential — merchant-locked, amount-scoped, live
> for 15 minutes." *(blur the passkey surface in edit)*
>
> **(1:08 — Step 6, Checkout)** "The agent checks out at the merchant. Here is the
> completed order result — `{real ord id}`." *(show `GET
> /prava/order/:id` with the real id on screen)*
>
> **(1:22 — Step 7, Card)** "Every state change mutates live in the iMessage
> thread — discovery, approval, confirmation."
>
> **(1:34 — closing)** "The deterministic self-check is available with `node
> scripts/prava-demo.mjs`; it validates orchestration shape and is explicitly
> labeled fixture-only. This production order is the separate transaction proof."

---

## Variant B — sandbox only (production access not granted in time)

Same timing. Replace the payment-claim lines:

> **(0:36 — Steps 3+4)** "The agent uses the discovered listed price as the
> sandbox session amount and opens a real Prava session. This is not a binding
> merchant quote. The UI shows the requested merchant and amount plus the
> controls Prava documents for a credential if issuance succeeds."
>
> **(0:52 — Step 5)** "The user approves with a passkey. Prava issues a one-time,
> merchant-locked, amount-scoped credential."
>
> **(1:08 — Step 6)** "Prava's real sandbox lifecycle completed: session created,
> test credential issued, an external sandbox checkout was attempted, and its
> processor result was reported `APPROVED`.
> No merchant was charged. The production CLI branch is implemented and linked
> but remains unvalidated pending production access."
>
> **(1:22 — Step 7)** "The status card distinguishes sandbox completion from a
> merchant order and states that no real charge occurred."
>
> **(1:34 — closing)** "We do not claim a merchant payment: this is Prava's real
> sandbox credential and `report-status` lifecycle. The separate deterministic
> script validates orchestration shape only and is labeled fixture-only."

---

## Variant C — Prava sandbox provider incident still open

Use this only if Prava has not fixed device binding before recording:

> **(0:52 — hosted payment surface)** "This is a real Prava sandbox session,
> created from a live UCP product and opened on Prava's hosted card surface.
> Prava accepted and rendered the order, merchant, MCC, amount, and product."
>
> **(1:02 — dashboard evidence)** "Earlier cards failed device binding before
> WebAuthn in Safari and Brave. Prava's later recommended card reached issuer
> OTP, then Visa returned `FETCH_AGENTIC_CREDS_ERROR` while fetching the
> cryptogram. Here is the failed sandbox session record. We reported the
> reproducible incident rather than replacing it with a fake success."
>
> **(1:18 — product UI + self-check)** "The planned orchestration states and
> trust UX remain judge-runnable with deterministic fixtures, explicitly labeled
> self-check. The live sandbox session creation and failure evidence are separate
> and never presented as a completed transaction."
>
> **(1:34 — closing)** "OnPoint's new Prava workflow is implemented and deployed;
> final credential issuance is blocked inside the hosted Prava/Visa flow.
> Production access is requested; the linked CLI checkout branch is
> implemented but has not been validated with a real merchant order."

## Do NOT say (either variant)

- "real order / real purchase / completed order at a merchant" — unless the
  successful production `shop checkout` result and merchant confirmation are on
  screen. An `ord_…` created with a sandbox session is not sufficient. The rules
  treat a mocked payment presented as a transaction as disqualification-grade.
- "sandbox completed" — unless `payment-result` reached `awaiting_result` and
  an external sandbox checkout was attempted before `report-status` produced a
  final `completed` state on Prava's real sandbox.
- Dates or claims about multi-merchant checkout (v1 is one merchant per look).
