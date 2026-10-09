# M-Pesa (Daraja STK Push) Setup

Internal runbook for human storefront checkout in Kenya. Agent checkout is a separate rail (cUSD on Celo) and is not covered here.

> Status: `implemented`. Not `live-validated` until one sandbox payment has passed the checklist below. Re-label after a live payment.

## How a payment flows

```
Storefront (MpesaPaymentPanel)
  → POST /api/curator/stk-push            (web app)   creates a pending payment in Redis,
                                                       indexed by CheckoutRequestID (7-day TTL)
  → Daraja STK Push                                  prompt appears on the customer's phone
  → customer enters their M-Pesa PIN
  → Safaricom POSTs {callback base}/api/curator/stk-callback?s=<secret>   (web app)
      checks the secret, finds the payment by CheckoutRequestID, checks the paid amount
      → marks it paid (or rejected)
      → POST {API}/api/orders/record      (x-service-key)   inserts the order; idempotent on the M-Pesa receipt
          → if the payment carried a share id: records one confirmed `sale` event
```

**Manual path.** A customer pays by other means and submits their M-Pesa code (`POST /api/curator/payments`). It stays `pending_verification` until an admin clicks **Verify & mark paid** in `/admin/curators/<slug>`. Verifying records the order in the ledger first (same endpoint as above, so it also counts as a sale for share attribution) and only then marks the payment paid. See "Manual verification" below.

## Configuration

Set on the web app (`fly secrets set -a onpoint-web …`):

| Variable | Notes |
| --- | --- |
| `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET` | From the Daraja app |
| `DARAJA_PASSKEY` | Sandbox: the public test passkey. Live: issued by Safaricom at go-live |
| `DARAJA_BUSINESS_SHORTCODE` | Sandbox `174379`. Live: your paybill or till |
| `DARAJA_SANDBOX` | Unset or anything but `false` means sandbox |
| `DARAJA_CALLBACK_BASE_URL` | **Set explicitly** to `https://onpoint.trustfall.xyz` |
| `DARAJA_CALLBACK_SECRET` | **Set this** (`openssl rand -hex 24`). Appended to the callback URL as `?s=` and required on every callback. Unset means unauthenticated callbacks are accepted and a warning is logged |
| `SERVICE_API_KEY` | Same value as the API's. Without it orders are never ledgered (a warning is logged and the callback still succeeds) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Without Redis no payment is persisted, and the callback cannot find it |
| `ADMIN_EMAILS` | Who may open the admin console to verify manual payments. See [auth.md](./auth.md#admin-access-admin-apiadmin) |

### Why `DARAJA_CALLBACK_BASE_URL` must be set

The callback base falls back through `APP_BASE_URL`, then `NEXT_PUBLIC_AGENT_API_URL`, then `http://localhost:3000`. `NEXT_PUBLIC_AGENT_API_URL` is the Express API (`api.onpoint.famile.xyz`), which has no `/api/curator/stk-callback`. If `APP_BASE_URL` is also unset, Safaricom's confirmations go to a 404 and no payment ever confirms.

### Why the callback needs a secret

Safaricom cannot send credentials, and the `CheckoutRequestID` the callback matches on is also returned to the paying browser. Without a secret, anyone who started a payment could post a forged "success" for it. The secret is part of the callback URL registered with Daraja at push time, so changing it only affects payments started afterwards. Payments already in flight were registered with the old URL; change it when nothing is pending, or accept that those callbacks will be rejected.

## What the callback checks

1. The `?s=` secret (when configured). A wrong or missing token returns `403` and changes nothing.
2. The payment exists: direct lookup by `CheckoutRequestID` first, then (for payments created before the index existed) a scan of the 200 most recent.
3. A replay of an already-paid payment is acknowledged and ignored: no second notification, no second order.
4. The paid amount equals the amount requested. A mismatch marks the payment `rejected` (`amount_mismatch: …`), is logged as an error, and is **not** ledgered.

## Manual verification

In `/admin/curators/<slug>`, expand a payment and click **Verify & mark paid**:

- The order is written to the ledger first, then the payment is marked paid.
- **Duplicate M-Pesa code:** if the code is already on another order the payment stays pending, is flagged "Code already used on another order", and the admin sees an error. Check the code before trying again.
- **Ledger unreachable:** the payment is marked paid with "Not in orders ledger" and a warning. Use **Retry recording order** once the API is back.
- Verifying twice never creates a second order. A payment that is already an order cannot be rejected from here.
- STK payments are never ledgered by this button (the callback owns that).

## Sandbox test (do before any live credentials)

1. Set the variables above with sandbox credentials. The callback URL must be publicly reachable (use a tunnel for local testing).
2. On a storefront, start an STK push with a Daraja sandbox test phone number.
3. Confirm, in order:
   - the response contains a `paymentId` and `persisted: true`;
   - after the simulated PIN, the payment's status becomes `paid` (the public polling endpoint `GET /api/curator/payments/status` returns only the status), and the stored payment record has `ledgerStatus: "recorded"` and an `orderId` (the admin table shows a warning badge only when it is *not* recorded);
   - exactly **one** row appears in `orders` with `source = 'site_buy'` and that M-Pesa receipt;
   - replaying the same callback body leaves **one** order and the response is `Already processed`;
   - posting the callback without `?s=` (or with a wrong one) returns `403`.
4. With a share id (`?sid=` and `look=` on the storefront URL), confirm one `look_storefront` event with `kind = 'sale'` in `funnel_events`, and still one after replaying the callback.
5. With a referral (`?referral=ref_…`), confirm `orders.referral_code` is set and **no** `agent_referrals` row exists (see below).
6. Manual path: submit a code, verify it as an admin, confirm one order; submit a second payment reusing the same code and confirm verification is refused.
7. Check the web logs for `Ledger rejected M-Pesa order` or `SERVICE_API_KEY not set`.

## Go live

1. Complete Safaricom's go-live for your shortcode and obtain the live passkey.
2. Replace the credentials and shortcode, then set `DARAJA_SANDBOX=false`.
3. Make one small real payment and repeat checks 3 and 7 above.
4. Update the status line at the top of this page.

## Referral commissions on human orders

A referral code (`?referral=` or the `/r/<code>` landing page) is captured for the session, sent with the payment, and stored on the order (`orders.referral_code`) **for attribution only**. No commission row is created. Agent API orders pay 2.5% in cUSD; M-Pesa orders settle in KES, so paying a commission needs a decision on conversion and who bears the exchange risk. Until that is made, human orders show who referred them but pay nothing.

## Known weaknesses

- **Secret in the callback URL.** It can appear in Safaricom-side or proxy logs. It protects against forgery by customers, not against a compromise of those logs. Rotate it if exposed.
- **The `recent` payment list is stale.** `updatePaymentInRedis` rewrites only the per-curator list, so the shared recent list (the legacy fallback) holds the pending copy. The direct checkout index is the source of truth for the callback.
- **Non-atomic updates.** `updatePaymentInRedis` reads, patches and rewrites a list, so two simultaneous updates to one curator's list can lose one.
- **Share ids and referral codes on payments are client-supplied.** A forged valid share id can attribute a sale to someone else's share, and a referral code is not authenticated. Treat both as analytics, never as the basis for paying anyone.
- **Manual codes are not checked against M-Pesa.** The curator confirms the code against their M-Pesa statement; the system only prevents reuse of a code already on an order.

## Code map

| Concern | Location |
| --- | --- |
| Daraja client, config, callback URL and token check | `apps/web/lib/payments/daraja.ts` |
| STK push + pending payment + checkout index | `apps/web/app/api/curator/stk-push/route.ts`, `apps/web/lib/payments/checkout-store.ts` |
| Callback | `apps/web/app/api/curator/stk-callback/route.ts` |
| Ledger call (shared by callback and admin verify) | `apps/web/lib/payments/ledger.ts` |
| Manual submission | `apps/web/app/api/curator/payments/route.ts` |
| Admin verify / reject / fulfilment | `apps/web/app/api/admin/curator/payments/route.ts`, `apps/web/app/admin/curators/[slug]/PaymentsTable.tsx` |
| Order ledger (`/record`) | `apps/api/routes/fulfillment.js` |
| Storefront UI | `apps/web/app/s/[slug]/MpesaPaymentPanel.tsx` |

Related: [growth-loop.md](./growth-loop.md) (how a confirmed sale is attributed to a share), [auth.md](./auth.md) (admin access), [whatsapp-setup.md](./whatsapp-setup.md).
