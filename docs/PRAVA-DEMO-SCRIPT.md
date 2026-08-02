# Prava Demo Video — Narration Script

Target length: 100–120 seconds. **Use Variant C for the submission recording.**
Prava confirmed that `Creds_Generated` is a successful Prava sandbox
transaction; the later Browser Harness checkout attempt timed out without a
definitive merchant outcome. Never mix those two claims.

## Recording rules (both variants)

- Do not create another Prava transaction for the recording. Sandbox cards have
  a 30-transaction daily limit. Use the existing successful dashboard record
  `ord_01KZ2A6YCE9HJGZ97C8CD5ZT1P` and pre-recorded hosted-flow evidence.
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

> **(0:36 — Steps 3+4)** "The agent obtains a binding Browser Harness quote,
> including shipping and tax, then opens a real Prava session for that exact
> total. The UI shows the requested merchant, ceiling, and credential controls."
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

## Variant C — current submission recording

### Shot list and narration

> **(0:00 — live OnPoint homepage)** "Most AI shopping stops at a
> recommendation. OnPoint is an iMessage stylist that discovers live fashion,
> checks fit before spend, and uses Prava to turn a user's permission into a
> one-time payment credential."
>
> **(0:12 — live search results)** Search `black Alo Yoga leggings under $130`.
> "This is live UCP discovery, not a hard-coded catalog: real Alo Yoga products,
> variants, prices, and images."
>
> **(0:27 — try-on or existing try-on capture)** "Before asking for money,
> OnPoint can render the garment on the shopper. Our insight is fit first,
> permission second."
>
> **(0:40 — quote/trust capture)** "Browser Harness produced a binding quote:
> $108 subtotal, free shipping, $9.32 tax, and a $117.32 ceiling. The permission
> is for Alo Yoga and that exact total."
>
> **(0:55 — Linq thread and status card)** "Linq makes this message-native. A
> real inbound iMessage triggers discovery and a status card; signed webhooks,
> replies, reactions, and the hosted Prava handoff are handled by OnPoint."
>
> **(1:10 — Prava dashboard record)** "On Prava's hosted surface, the
> team-provided card completed verification. This real sandbox record is
> `Creds_Generated` for $117.32. Prava confirmed that this is a successful
> sandbox transaction."
>
> **(1:26 — sanitized poll response or code view)** "OnPoint then polled
> `payment-result` and reached `credential_ready`. The one-time credential stayed
> server-side; no card number, cryptogram, API key, or personal data appears in
> the application response or recording."
>
> **(1:41 — outcome disclosure)** "We made one authorized Browser Harness
> checkout attempt. It returned an unknown automation timeout, so OnPoint did
> not retry and did not fabricate an approval or decline. We claim successful
> Prava credential generation—not an Alo Yoga order or charge."
>
> **(1:55 — product/public agent screen)** "OnPoint was already a live fashion
> commerce platform. During the hackathon we added this Prava and Linq workflow:
> live discovery, fit verification, explicit permission, and safe credential
> handling. Fit before you buy—for people and agents."

### Evidence to keep on screen

- Prava order: `ord_01KZ2A6YCE9HJGZ97C8CD5ZT1P`
- Amount: `$117.32 USD` (`$108.00` subtotal + `$9.32` tax)
- State: `Creds_Generated`; OnPoint state: `credential_ready`
- Merchant/category: Aloyoga; clothing stores (`5691`)
- Linq: real thread/card plus the OnPoint iMessage number; do not show secrets
- Browser Harness attempt: describe the unknown timeout verbally or with a
  cropped sanitized result; never present it as a merchant decline

## Do NOT say (either variant)

- "real order / real purchase / completed order at a merchant" — unless the
  successful production `shop checkout` result and merchant confirmation are on
  screen. An `ord_…` created with a sandbox session is not sufficient. The rules
  treat a mocked payment presented as a transaction as disqualification-grade.
- "sandbox completed" — unless `payment-result` reached `awaiting_result` and
  an external sandbox checkout was attempted before `report-status` produced a
  final `completed` state on Prava's real sandbox.
- "the payment succeeded at Alo Yoga" or "the merchant declined" — the one
  checkout attempt had an unknown automation outcome.
- Dates or claims about multi-merchant checkout (v1 is one merchant per look).
