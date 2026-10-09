# ADR 0021: Public Route Hardening (Prices, Listings, Redis Paths, Payment IDs)

**Status**: Accepted
**Date**: 2026-10-09
**Related**: ADR 0020 (admin gate and payment confirmation), ADR 0010 (agent storefront checkout)

## Context

ADR 0020 closed the open admin console. Reviewing the remaining `apps/web/app/api/curator/*` routes found further problems reachable without any credentials:

1. **Listing writes were unauthenticated.** `POST /api/curator/listings` merged sizes into any curator's existing listing, so anyone could overwrite its price and stock. Agent checkout charges the listing price. Its only protection was IP rate limiting, with a comment that ownership should be verified "in a future iteration".
2. **Payment amounts were client-trusted.** The storefront computed `amount` in the browser; `stk-push` and the manual route accepted it, and the STK callback then compared the payment against that same client-chosen amount. A tampered request could pay 1 KES for a 3000 KES kit and still be confirmed and ledgered.
3. **Manual payments accepted a client-supplied `status`**, so a customer could submit one already marked paid.
4. **Redis key injection.** `push-subscribe` built `${url}/del/${key}` from a raw `paymentId`. Upstash treats path segments as command arguments, so a crafted ID could delete arbitrary keys (for example a curator's payment list). Several helpers also placed unvalidated curator slugs in URL paths.
5. **Weak payment IDs.** IDs were `stk_<ms timestamp>_<7 base36 chars from Math.random()>`, and several customer endpoints (status, tracking, delivery) are authorised by knowing the ID alone. `Math.random()` is not cryptographic.
6. **Delivery addresses could be changed by anyone holding the link at any time**, including after dispatch, and the endpoint echoed the whole stored payment record.
7. Several public write routes had no rate limiting.

## Decision

1. `POST /api/curator/listings` is **admin only** (`requireAdmin`, same policy as ADR 0020). Curators currently have no verifiable web identity, so inventory changes go through the operator console or the WhatsApp agent until real curator authentication exists.
2. **Verify the price server-side** before any payment is created (`lib/payments/price-check.ts`). The amount must equal the listing's price for that size, the size must exist and be in stock. If the price cannot be verified, the payment is not started (fail closed).
3. **Status is never client-controlled.** Manual payments are always created `pending_verification`.
4. **No user input in Redis URL paths.** `push-subscribe` now sends JSON pipeline commands, validates the slug and payment ID against whitelists, requires the payment to exist for that curator, caps the stored payload, and sets a TTL. The shared helpers refuse any slug that is not `^[a-z0-9-]{2,64}$`.
5. **Payment IDs carry 96 random bits** from the OS CSPRNG. Legacy IDs remain valid so existing receipts and tracking links keep working. ID-based endpoints validate the format first and are rate limited (300/min per client, generous because many mobile users share a carrier NAT).
6. **Delivery details are locked** once an order is ready for pickup, assigned to a rider, or delivered, and for rejected payments. The endpoint returns only `{ success: true }`.
7. Public write and read routes that lacked limits (`views`, `analytics/track`, `leads` POST, `recommendations`) are rate limited.

## Consequences

- **Curators lose the in-browser inventory form** (`InventoryForm`) until curator auth exists; it now explains why and points to the WhatsApp agent or an admin. Re-opening it needs a verifiable owner identity (for example an Auth0-linked curator account or a signed owner token issued at onboarding), not the public WhatsApp number.
- Starting a payment now depends on the API being reachable to read the price. The storefront page already does, and the payment ledger call does too.
- Legacy payment IDs keep their weaker 36-bit random part until they age out. Rate limiting and the unguessable timestamp-plus-random shape make guessing impractical, but they are not equivalent to new IDs.
- Not changed: `customerEmail` on the delivery request lets anyone holding a payment ID have a receipt sent to an address of their choosing; `updatePaymentInRedis` is a non-atomic read-modify-write; `analytics/funnel` remains a public proxy of four aggregate counters.
- The route inventory and the conventions that would have prevented these are in [ops/auth.md](../ops/auth.md#web-apicurator-route-inventory).
