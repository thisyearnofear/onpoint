# Prava Demo Video — Narration Script (two variants)

Record with `node scripts/prava-demo.mjs` (self-check) or `--live` + `LINQ_DEMO_TO`.
Target length: ~100 seconds. Pick **Variant A** if production access landed and a
real merchant order completed; **Variant B** otherwise. Never mix claims between
variants.

## Recording rules (both variants)

- Rehearse the whole run in self-check mode first (free). Sandbox card allows
  **30 transactions/day** — batch all real transactions into one take.
- **Never show** API keys, the sandbox card number/CVV, or `PRAVA_*`/`LINQ_*` env
  values. Crop or blur the passkey/payment surface when recording Step 5.
- Show the trust block (spend ceiling, merchant scope, guardrails) prominently at
  Steps 3–4 — the Visa judges score controls explicitly.
- Show the 👍 tapback → card flip clearly — this is the Linq track's thesis.
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
> completed order result — `{real ord id}` — with the receipt." *(show `GET
> /prava/order/:id` with the real id on screen)*
>
> **(1:22 — Step 7, Card)** "Every state change mutates live in the iMessage
> thread — discovery, approval, confirmation."
>
> **(1:34 — closing)** "The judge-runnable proof is `node scripts/prava-demo.mjs`
> — 15/15 assertions, no credentials needed. OnPoint was already a live product;
> Prava is how its agents finish the job."

---

## Variant B — sandbox only (production access not granted in time)

Same timing. Replace the payment-claim lines:

> **(0:36 — Steps 3+4)** "The agent locks a binding quote and opens a Prava
> payment session in the sandbox. Note the trust block: spend ceiling, merchant
> scope, single-use credential. The user's card is never exposed to the agent."
>
> **(0:52 — Step 5)** "The user approves with a passkey. Prava issues a one-time,
> merchant-locked, amount-scoped credential."
>
> **(1:08 — Step 6)** "The sandbox session completes end to end — session created,
> credential issued, status reported `APPROVED` → `completed`. The merchant charge
> itself is a production path: we applied for temporary hackathon production
> access, and the production wiring (`PRAVA_CLI_PATH`, agent linked, facade live
> mode) is already deployed behind one flag."
>
> **(1:22 — Step 7)** "Every state change mutates live in the iMessage thread —
> discovery, approval, confirmation."
>
> **(1:34 — closing)** "Everything you watched is reproducible: `node
> scripts/prava-demo.mjs` runs the full spine with 15/15 assertions, no
> credentials needed. We did not fake a payment — the sandbox shows exactly the
> transaction stages Prava performed, and the production path is one approved
> flag away."

## Do NOT say (either variant)

- "real order / real purchase / completed order at a merchant" — unless the
  completed checkout result (real `ord_…`) is on screen. The rules treat a
  mocked payment presented as a transaction as disqualification-grade.
- Dates or claims about multi-merchant checkout (v1 is one merchant per look).
