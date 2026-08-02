# Prava Demo Video — Narration Script

Target length: 105–110 seconds. This is the only submission recording script.
Prava confirmed that `Creds_Generated` is a successful Prava sandbox
transaction; the later Browser Harness checkout attempt timed out without a
definitive merchant outcome. Never mix those two claims.

## Recording rules

- Do not create another Prava transaction for the recording. Sandbox cards have
  a 30-transaction daily limit. Use the existing successful dashboard record
  `ord_01KZ2A6YCE9HJGZ97C8CD5ZT1P` and pre-recorded hosted-flow evidence.
- **Never show** API keys, the sandbox card number/CVV, or `PRAVA_*`/`LINQ_*` env
  values. Crop or blur the passkey/payment surface when recording Step 5.
- Show the trust block (spend ceiling, merchant scope, guardrails) prominently at
  Steps 3–4 — the Visa judges score controls explicitly.
- Label cuts explicitly: `LIVE UCP`, `LIVE LINQ — INDEPENDENTLY VALIDATED`, and
  `CAPTURED PRAVA SANDBOX RUN`.
- Do not imply that the independently validated Linq thread and successful
  Prava record were captured as one uninterrupted conversation.
- Phone screen recordings should be clean; no notifications enabled.

---

## Submission recording

### Shot list and narration

> **(0:00–0:10 — live OnPoint homepage)** "Most AI shopping stops at a
> recommendation. OnPoint is an iMessage stylist that discovers live fashion,
> checks fit before spend, and turns a user's narrow permission into a
> one-time payment credential."
>
> **(0:10–0:24 — LIVE UCP search)** Search `black Alo Yoga leggings under $130`.
> "This is live UCP discovery, not a hard-coded catalog: real Alo Yoga products,
> variants, prices, and images."
>
> **(0:24–0:36 — existing try-on capture)** "OnPoint can render the garment on
> the shopper before approval. Fit is not decoration—it is the reason to grant
> or withhold permission."
>
> **(0:36–0:52 — quote and trust contract)** "Browser Harness produced a binding
> quote: $108 subtotal, free shipping, $9.32 tax, and a $117.32 ceiling. The
> session requested Alo Yoga and that exact ceiling; nothing was charged."
>
> **(0:52–1:06 — LIVE LINQ — INDEPENDENTLY VALIDATED)** "Linq makes the intent,
> status, and Prava handoff message-native. A
> real inbound iMessage triggers discovery and a status card; signed webhooks,
> replies, and reactions are handled by OnPoint. The tapback refreshes status;
> authorization remains on Prava's hosted surface."
>
> **(1:06–1:24 — CAPTURED PRAVA SANDBOX RUN)** "On Prava's hosted surface, the
> team-provided card completed verification. This real sandbox record is
> `Creds_Generated` for $117.32. Prava confirmed that this is a successful
> sandbox transaction. OnPoint's matching poll reached `credential_ready`; the
> one-time credential stayed server-side."
>
> **(1:24–1:37 — safety outcome)** "We made one authorized Browser Harness
> checkout attempt. It returned an unknown automation timeout, so OnPoint did
> not retry or report an invented result. We claim successful Prava credential
> generation—not an Alo Yoga order or charge."
>
> **(1:37–1:48 — live product close)** "OnPoint was already a live fashion
> commerce platform. During the hackathon we added this Prava and Linq workflow:
> live discovery, fit verification, explicit permission, and safe credential
> handling. The fashion agent that earns permission to buy."

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
