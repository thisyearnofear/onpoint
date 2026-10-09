# ADR 0020: Admin Gate and Payment Confirmation Hardening

**Status**: Accepted
**Date**: 2026-10-09
**Related**: ADR 0001 (backend-first autonomy; the Postgres ledger), ADR 0010 (agent storefront checkout), ADR 0019 (share attribution)
**Amends**: ADR 0019 (its consequences about manual M-Pesa sales and the storefront ignoring `referral`)

## Context

Making manual M-Pesa payments countable required the admin "verify" action to write to the orders ledger. Reading it first showed that `/admin/*` pages and `/api/admin/*` routes had **no access control at all**: `proxy.ts` ran only Auth0's session middleware, and no route checked who was calling. That exposed customer phone numbers and delivery addresses, let anyone mark payments paid or trigger WhatsApp messages to customers, and put a proxy that attaches the API service key behind a URL anyone could call. Wiring verify to the ledger without fixing this would have let anyone fabricate orders and attributed sales.

The STK callback had a related weakness: it matched on a `CheckoutRequestID` that is also returned to the paying browser, so the payer could post a forged success. It also found payments by scanning only the 200 most recent, so a late callback could be lost.

## Decision

1. **Gate the operator console.** `proxy.ts` requires, for `/admin/*` and `/api/admin/*`, an Auth0 session whose **verified** email is on the allowlist (`ADMIN_EMAILS`, falling back to `ADMIN_EMAIL`). Anonymous callers get a login redirect (pages) or `401` (API); signed-in non-admins get `403`; **no configured allowlist fails closed with `503`**. An unverified email is rejected even if it matches, because anyone can self-register one. The policy is a pure function (`lib/utils/admin-access.ts`) with unit tests. The admin proxy also rejects `.`/`..`/slash path segments so it cannot climb out of the API's `/api/admin/*` namespace.
2. **Authenticate the Safaricom callback with a shared secret** (`DARAJA_CALLBACK_SECRET`) carried in the registered callback URL and compared in constant time. Unset keeps the legacy unauthenticated behavior, with a warning on every callback. Also: verify the paid amount equals the requested amount (mismatch is rejected and not ledgered), ignore replays of an already-paid payment, and look payments up directly by `CheckoutRequestID` (7-day TTL index), falling back to the old scan.
3. **Verify writes the ledger first, then marks paid.** For manual payments only (STK callbacks ledger themselves). The orders table is unique on the M-Pesa receipt, so a code already on another order is refused and the payment stays pending, flagged for review. A ledger outage still verifies the payment but records `ledgerStatus: failed` and is retryable from the UI. Verifying is idempotent, and a payment that is already an order cannot be rejected from this screen.
4. **Referral codes on human orders are captured for attribution only.** The storefront now reads `?referral=` and the `/r/<code>` landing code, sends it with the payment, and `/api/orders/record` stores it on the order. **No commission row is created.** Agent API orders pay 2.5% in cUSD; M-Pesa orders settle in KES, and whether and how to pay a commission on them is an unresolved business decision.
5. **A referral code must resolve to a payable address.** Codes are resolved through a prior referral row, then the agent that owns looks with a matching derived code (must be unique). An unresolvable or ambiguous code records no commission. Previously an unrecognised code was stored as the agent's address, which could never be paid.

## Consequences

- **Deploy sequencing matters.** The web app that contains the gate returns `503` for `/admin` until `ADMIN_EMAILS` (or `ADMIN_EMAIL`) is set to a verified Auth0 email. Set it first.
- Setting `DARAJA_CALLBACK_SECRET` changes the callback URL for payments started afterwards; in-flight payments registered with the old URL will be rejected. Change it when nothing is pending.
- Manual payments now count as sales in share attribution once verified, which supersedes the limit stated in ADR 0019.
- Other `/api/curator/*` routes (leads, tracking, delivery, …) were not part of this change and are not behind the gate. They need their own review.
- Not addressed: the callback is still reachable from any address (the secret is the only check), `updatePaymentInRedis` is a non-atomic read-modify-write, and manual M-Pesa codes are not validated against Safaricom.
- Operating details: [ops/mpesa-setup.md](../ops/mpesa-setup.md) and [ops/auth.md](../ops/auth.md#admin-access-admin-apiadmin).
