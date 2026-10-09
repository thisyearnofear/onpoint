# M-Pesa (Daraja STK Push) Setup

Internal runbook for human storefront checkout in Kenya. Agent checkout is a separate rail (cUSD on Celo) and is not covered here.

> Status: `implemented`. Not `live-validated` until one sandbox payment has passed the checklist below. Re-label after a live payment.

## How a payment flows

```
Storefront (MpesaPaymentPanel)
  → POST /api/curator/stk-push            (web app)   creates a pending payment in Redis
  → Daraja STK Push                                  prompt appears on the customer's phone
  → customer enters their M-Pesa PIN
  → Safaricom POSTs {callback base}/api/curator/stk-callback   (web app, unauthenticated)
      finds the payment by CheckoutRequestID, marks it paid or rejected
      → POST {API}/api/orders/record      (x-service-key)   inserts the order; idempotent on the M-Pesa receipt
          → if the payment carried a share id: records one confirmed `sale` event
```

Manual path: a customer pays elsewhere and submits their M-Pesa code (`POST /api/curator/payments`). The record stays `pending_verification`. **Nothing confirms it or writes it to the orders ledger yet**, so manual payments are not counted as sales anywhere, including share attribution.

## Configuration

Set on the web app (`fly secrets set -a onpoint-web …`):

| Variable | Notes |
| --- | --- |
| `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET` | From the Daraja app |
| `DARAJA_PASSKEY` | Sandbox: the public test passkey. Live: issued by Safaricom at go-live |
| `DARAJA_BUSINESS_SHORTCODE` | Sandbox `174379`. Live: your paybill or till |
| `DARAJA_SANDBOX` | Unset or anything but `false` means sandbox |
| `DARAJA_CALLBACK_BASE_URL` | **Set explicitly** to `https://onpoint.trustfall.xyz` |
| `SERVICE_API_KEY` | Same value as the API's. Without it the order is never ledgered (a warning is logged and the callback still succeeds) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Without Redis no payment is persisted, and the callback cannot find it |

### Why `DARAJA_CALLBACK_BASE_URL` must be set

The callback base falls back through `APP_BASE_URL`, then `NEXT_PUBLIC_AGENT_API_URL`, then `http://localhost:3000`. `NEXT_PUBLIC_AGENT_API_URL` is the Express API (`api.onpoint.famile.xyz`), which has no `/api/curator/stk-callback`. If `APP_BASE_URL` is also unset, Safaricom's confirmations go to a 404 and no payment ever confirms.

## Sandbox test (do before any live credentials)

1. Set the variables above with sandbox credentials. The callback URL must be publicly reachable (use a tunnel for local testing).
2. On a storefront, start an STK push with a Daraja sandbox test phone number.
3. Confirm, in order:
   - the response contains a `paymentId` and `persisted: true`;
   - after the simulated PIN, the payment's status becomes `paid` (`GET /api/curator/payments/status`);
   - exactly **one** row appears in `orders` with `source = 'site_buy'` and that M-Pesa receipt;
   - replaying the same callback (resend the saved body) leaves **one** order. The receipt is unique, so retries are safe.
4. With a share id (`?sid=` and `look=` on the storefront URL), confirm one `look_storefront` event with `kind = 'sale'` in `funnel_events`, and still one after replaying the callback.
5. Check the web logs for `Ledger rejected M-Pesa order` or `SERVICE_API_KEY not set`.

## Go live

1. Complete Safaricom's go-live for your shortcode and obtain the live passkey.
2. Replace the credentials and shortcode, then set `DARAJA_SANDBOX=false`.
3. Make one small real payment and repeat checks 3 and 5 above.
4. Update the status line at the top of this page.

## Known weaknesses

- **The callback is unauthenticated.** It trusts any request whose `CheckoutRequestID` matches a stored payment. Restricting it to Safaricom's published source addresses would harden it.
- **Only the 200 most recent payments are searched** (the shared `recent` list in Redis). On a busy day a late callback for an older payment can be reported "payment not found" and the order is never ledgered. A direct lookup by `checkoutRequestId` fixes this.
- **Manual payments have no confirmation path** (see above).
- **Share ids on payments are client-supplied.** A forged but valid id can attribute a sale to someone else's share. Treat per-share numbers as analytics, never as the basis for paying anyone.

## Code map

| Concern | Location |
| --- | --- |
| Daraja client, config, callback parsing | `apps/web/lib/payments/daraja.ts` |
| STK push + pending payment | `apps/web/app/api/curator/stk-push/route.ts` |
| Callback + ledger call | `apps/web/app/api/curator/stk-callback/route.ts` |
| Manual submission | `apps/web/app/api/curator/payments/route.ts` |
| Order ledger (`/record`) | `apps/api/routes/fulfillment.js` |
| Storefront UI | `apps/web/app/s/[slug]/MpesaPaymentPanel.tsx` |

Related: [growth-loop.md](./growth-loop.md) (how a confirmed sale is attributed to a share), [whatsapp-setup.md](./whatsapp-setup.md).
