# PayPal AI Hackathon — OnPoint

Status: `implemented` (mocked-network tests pass). Not yet `live-validated` — needs one recorded sandbox run.

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
`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox|live` (see `apps/api/.env.example`). Rail is absent from the 402 when unset or if order creation fails.

## Checklist
- [x] `apps/api/lib/paypal-payments.js` (token cache, create, verify+capture)
- [x] Quote + verify in try-on and order routes; mixed proofs rejected
- [x] Replay guard; binding of approved order to one resource
- [x] Demo: `RAIL=paypal node scripts/near-spike/agent-demo.mjs` (local script, gitignored)
- [ ] Create sandbox business + personal accounts, set secrets in the API environment
- [ ] Record one live sandbox run (402 -> approve -> 201 receipt)
- [ ] Deploy and add `paypal` result to the demo video

## Related work shipped alongside
- Garment attributes on listings (`listings.attributes`, migration `0011`) and `?type=&formality=&warmth=` storefront filters.
- Gemini image stage in the try-on fallback chain (YouCam -> Replicate -> Gemini -> Venice).
- `POST /api/agent/outfit`: deterministic outfit planner over live inventory.

## Risks
- Migration `0011` must be applied before deploying code that selects `listings.attributes`.
- No NEAR-style trustless verification: correctness relies on PayPal API responses and server credentials.
