# PayPal AI Hackathon — OnPoint

Status: `live-validated` (2026-11-12, sandbox, on production API `api.onpoint.famile.xyz`).

Live evidence (re-verifiable without credentials):
- Rail advertisement — `POST /api/agent/try-on` returns **HTTP 402** with `quote.paymentRails: ["celo_cusd","near","paypal"]` and `quote.paypal = { env: "sandbox", orderId, approveUrl, amountUsd, currency: "USD", instructions }`.
- Human front door — `https://onpoint.trustfall.xyz/pay`: add a photo, choose PayPal, approve in a new tab, and the render develops on the page with its capture id, fit read and public receipt. No order id is pasted; the page checks the quoted order when the payer returns to the tab.
- Try-on and order rails were both exercised end to end on 2026-11-12 (402 → approve → 200/201 with `paymentMethod: "paypal"` and a PayPal capture id as the proof).
- Recorded run (2026-11-12, after the receipt-persistence fix): PayPal try-on of "Cape Town Shweshwe Matchday" from Nia Digital — capture `13K55568GE972304A`, $0.03, render by `youcam-cloth-v4`, fit read by Otari. Receipt: https://onpoint.trustfall.xyz/receipt/receipt_mwdjib6r_ba423717 · try-on page: https://onpoint.trustfall.xyz/p/a2c86aef-0deb-47f3-8ca2-91412c853bea. Receipt ids from the first runs that morning (`receipt_mwd6vc1f_f41b1052`, `receipt_mwd6q4fj_e03e5326`) no longer resolve — see Risks.
- Receipts are public: `GET https://api.onpoint.famile.xyz/api/receipts/{receiptId}` — a judge can read the PayPal proof themselves.

### Try it as a judge (PayPal)

The demo is completable end-to-end without our credentials:

1. Open https://onpoint.trustfall.xyz/pay?curator=nia, add any photo of a person, pick a piece, get the price.
2. Choose **PayPal**. The approve link opens PayPal **sandbox** checkout — sign in with **any sandbox personal account**. Every PayPal developer account auto-creates one under developer.paypal.com → Dashboard → Testing tools → Sandbox accounts (type "Personal").
3. Come back to the tab; the agent verifies, captures, renders, signs a receipt and pays the seller share out over Payouts. The receipt page shows the capture id and the payout batch.

## Thesis
One executable fashion offer, three ways to pay: `paymentRails: ['celo_cusd', 'near', 'paypal']`.

## Architecture: approval relay
Classic PayPal Checkout needs a human to approve at paypal.com, so the agent orchestrates and the human authorizes.

1. Agent calls `POST /api/agent/try-on` or `POST /api/curator/{slug}/order` -> HTTP 402.
2. `quote.paypal = { env, orderId, approveUrl, amountUsd, currency: 'USD' }` (order created server-side, intent CAPTURE).
3. Agent relays `approveUrl` to its human; human approves.
4. Agent re-POSTs with `{ paypalOrderId }` (orders also send `quoteId`).
5. Server GETs the order, checks `custom_id` binding, currency, amount >= price and status APPROVED, then captures (idempotent via `PayPal-Request-Id`) and requires COMPLETED.
6. `captureId` is the proof id (replay-guarded in the same column as NEAR/Celo tx hashes). Receipt `chain: 'paypal'`, `paymentMethod: 'paypal'`, asset USD.

Orders and try-ons are captured to the platform account; after capture the agent pays the seller's share out over **PayPal Payouts** (`POST /v1/payments/payouts`) when `PAYPAL_SELLER_PAYOUT_EMAIL` is set — the payout batch id is recorded on the receipt, which then reads "Sent via PayPal Payouts" instead of `pending_reconciliation`. The batch id is derived from the PayPal order id, so a replayed verify can never double-pay. When the env var is unset (or the payout call fails), the sale still stands and the payout is recorded as `pending_reconciliation`. The sandbox receiver stands in for the curator/seller, who in production would configure their own PayPal email.

## Configuration
`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox|live` (see `apps/api/.env.example`). Rail is absent from the 402 when unset or if order creation fails. Currently set on the production API in sandbox mode; the rail auto-advertises, so no code flag is involved.

## Event essentials
- **Devpost: PayPal AI Hackathon — "Build what's next with PayPal and AI".** Deadline **12 Nov 2026 20:00 UTC**; online, public, $67,500+ cash.
- Hard requirement: the project must **meaningfully use both PayPal and AI**. No prescribed tracks.
- **Functional demo** is mandatory and a mockup does not count — either complete setup/run instructions in the repo, or a hosted demo URL. We ship both: live API (`api.onpoint.famile.xyz`) + live web (`/pay`), plus the scripted reproducer below.
- **Public, open-source repo with a visible license** — MIT at [./LICENSE](../LICENSE).
- **Demo video**: under 3 minutes (judges are not required to watch past that), publicly visible on YouTube, showing the project running on the device it was built for, and **carrying no third-party trademarks or copyrighted music without permission** — no licensed music bed, non-PayPal brand marks out of frame.
- **Tools disclosure**: name the model/AI service and how it was used (next section).
- Existing projects are eligible provided meaningful progress happens during the event: PayPal rail `4a1bce8` (Nov 3), `/pay` as a checkout `908ecfe` (Nov 6), sandbox secrets on prod + live capture today, and the metered-AI receipt surface `954afdc` (Nov 11).

## AI used, and where
| Component | What it does |
| --- | --- |
| [Otari](https://otari.ai) (Mozilla AI) — OpenAI-compatible gateway. It serves production today. A Sandbase-first path is in the code but stays inactive until `SANDBASE_API_KEY` is set on the server (it is not), and Otari is always used when an agent sends its own `x-otari-key` | Vision + chat for the fit signal, styling notes, garment attributes and look classification on every paid try-on. Every response carries a per-call cost, surfaced as `aiCost`: Otari reports the cost it settled; if Sandbase is ever enabled, its cost is computed from the call's token usage at the model's published price, and left null when that price can't be read. |
| YouCam `cloth-v4` (→ Replicate IDM-VTON → Venice fallback) | Image-conditioned render: the actual garment on the actual person. |
| Deterministic rails layer | The agent decides *whether* to spend; PayPal supplies the human approval that releases it. |

Example from a live paid try-on served by Otari: `aiCost: { provider: "otari", model: "deepseek/deepseek-v4.1-flash-1017", costUsd: 0.000281, meteredBy: "onpoint-workspace" }` — the cost the gateway settled, written into the polaroid sidecar a judge can open. `aiCost.provider` names whichever gateway actually served the call.

## How we answer each judging criterion
- **Technological Implementation** — approval-relay over two endpoints (try-on + order), `custom_id` resource binding, amount/currency/status checks, idempotent capture via `PayPal-Request-Id`, capture id as the replay-guarded proof in the same column as Celo/NEAR hashes.
- **Design** — the human half is a real screen: `/pay` ("See it on you") keeps the payer's photo beside the piece, offers every rail the 402 advertises as an equal choice (PayPal, NEAR, cUSD — nothing preselected), develops the render as a polaroid while the payer guesses the fit score, and ends on a shareable result with the receipt. The agent's work is a first-person trace; "Show the details" reveals the HTTP 402, PayPal order and capture ids, and the inference cost. Not a curl-only proof of concept.
- **Potential Impact** — agents cannot today spend a human's PayPal money with the human's consent; this is the consent path for agentic commerce in a category (fashion) where the purchase is fit-dependent.
- **Innovation** — three rails, one offer: the *same* executable item is payable in cUSD, NEAR, or USD-with-human-approval, and only the PayPal rail keeps a human in the loop by design.
- **Presentation** — one 402 → approve → 201 arc on camera, then the public receipt readback.

## Checklist
- [x] `apps/api/lib/paypal-payments.js` (token cache, create, verify+capture)
- [x] Quote + verify in try-on and order routes; mixed proofs rejected
- [x] Replay guard; binding of approved order to one resource
- [x] Demo: `RAIL=paypal node scripts/near-spike/agent-demo.mjs` — committed, runnable by judges
- [x] Create sandbox business + personal accounts, set secrets in the API environment
- [x] Record one live sandbox run (402 -> approve -> 201 receipt)
- [x] Deploy (`PAYPAL_*` on `snel-bot:/opt/onpoint/shared/api/.env`, prod 402 advertises `paypal`)
- [ ] Add `paypal` result to the demo video
- [x] `/pay` PayPal flow live on the deployed web host (2026-11-12) — quote, choice and approval hand-off verified on production; the result screen verified with a real sandbox approval by the operator
- [ ] YouTube upload of the <3 min demo, publicly visible
- [ ] Devpost form: description, tools, repo link, hosted demo link

## Related work shipped alongside
- Garment attributes on listings (`listings.attributes`, migration `0011`) and `?type=&formality=&warmth=` storefront filters.
- Gemini image stage in the try-on fallback chain (YouCam -> Replicate -> Gemini -> Venice).
- `POST /api/agent/outfit`: deterministic outfit planner over live inventory.

## Risks
- Migration `0011` must be applied before deploying code that selects `listings.attributes`.
- No NEAR-style trustless verification: correctness relies on PayPal API responses and server credentials.
- **Receipts recorded before 2026-11-12 ~12:45 UTC are gone.** agent-core stored its ledgers through Upstash REST helpers, but the server only has `REDIS_URL`, so receipts lived in the API process's memory and every restart erased them. The API now installs its own Redis as the store (`apps/api/lib/persistent-state-redis.js`), and a failed read can no longer be mistaken for an empty ledger. Orders and payments (Postgres) and polaroids (R2) were never affected. Link a receipt from a run made after that fix.
- **Rate limit on the try-on endpoint:** 30 requests/minute and 300/day per IP (its own tier since 2026-11-12; it was 5/minute and 20/day, which locked out a person trying three pieces in a minute). Quotes count. `/pay` does not poll, the web proxy forwards the visitor's IP, and hitting the limit shows a countdown or a "today's fitting room" panel rather than an error.
- **Catalogue marks:** five club-named Nia designs were paused on 2026-11-12 because the generated images carried club crests and sponsor names; the three original Nia images still carry a Venice watermark. Keep both out of the video (no third-party trademarks).
