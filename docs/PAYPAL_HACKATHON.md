# PayPal AI Hackathon — OnPoint

Status: `live-validated` (2026-11-12, sandbox, on production API `api.onpoint.famile.xyz`).

Live evidence (re-verifiable without credentials):
- Rail advertisement — `POST /api/agent/try-on` returns **HTTP 402** with `quote.paymentRails: ["celo_cusd","near","paypal"]` and `quote.paypal = { env: "sandbox", orderId, approveUrl, amountUsd, currency: "USD", instructions }`.
- Try-on rail: 402 → approve (`06J754636E437522A`, $0.03) → **HTTP 200**; polaroid + receipt `receipt_mwd6vc1f_f41b1052` (`paymentMethod: "paypal"`, payer `4B5A6SR9HECG4`, item "NEAR FC home kit (2026-27)" on `onpoint-store`). Capture `8R078054E73723054` is in the run log, not in the receipt payload.
- Order rail: 402 (`0cc69356-S-1-29907762`, $16.92) → approve (`2TN41181T9243051V`) → **HTTP 201**; order `77b680d6`, receipt `receipt_mwd6q4fj_e03e5326` with `paypal: { orderId: "2TN41181T9243051V", captureId: "7WB40036EN816213E", amountUsd: 16.92, env: "sandbox" }` and `payout.status: "pending_reconciliation"`.
- Both receipts are public: `GET https://api.onpoint.famile.xyz/api/receipts/{receiptId}` — a judge can read the PayPal proof themselves.

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

Orders are paid to the platform account; curator payout is recorded as `pending_reconciliation` (PayPal Payouts is out of scope for v1).

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
| [Otari](https://otari.ai) (Mozilla AI) — OpenAI-compatible gateway | Vision + chat for the fit signal, styling notes, garment attributes and look classification on every paid try-on. Every response carries settled server-side cost, surfaced as `aiCost`. |
| YouCam `cloth-v4` (→ Replicate IDM-VTON → Venice fallback) | Image-conditioned render: the actual garment on the actual person. |
| Deterministic rails layer | The agent decides *whether* to spend; PayPal supplies the human approval that releases it. |

Example from a live paid try-on: `aiCost: { provider: "otari", model: "deepseek/deepseek-v4.1-flash-1017", costUsd: 0.000281, meteredBy: "onpoint-workspace" }` — real settled cost, not an estimate, and it is written into the polaroid sidecar a judge can open.

## How we answer each judging criterion
- **Technological Implementation** — approval-relay over two endpoints (try-on + order), `custom_id` resource binding, amount/currency/status checks, idempotent capture via `PayPal-Request-Id`, capture id as the replay-guarded proof in the same column as Celo/NEAR hashes.
- **Design** — the human half is a real screen: `/pay` renders whatever rails the 402 advertises, hands the payer the approve link, then verifies and shows the paid render. Not a curl-only proof of concept.
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
- [ ] `/pay` PayPal tile verified on the deployed web host (needs the `WEB_BASE_URL` + `NEXT_PUBLIC_R2_PUBLIC_URL` fixes in [docs/ops/deployment.md](ops/deployment.md))
- [ ] YouTube upload of the <3 min demo, publicly visible
- [ ] Devpost form: description, tools, repo link, hosted demo link

## Related work shipped alongside
- Garment attributes on listings (`listings.attributes`, migration `0011`) and `?type=&formality=&warmth=` storefront filters.
- Gemini image stage in the try-on fallback chain (YouCam -> Replicate -> Gemini -> Venice).
- `POST /api/agent/outfit`: deterministic outfit planner over live inventory.

## Risks
- Migration `0011` must be applied before deploying code that selects `listings.attributes`.
- No NEAR-style trustless verification: correctness relies on PayPal API responses and server credentials.
