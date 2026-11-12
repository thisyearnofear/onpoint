# paypal-plan.md — APIMatic Context Plugin contract sheet

Built with the **APIMatic Context Plugin for PayPal** (`npx context-plugins install paypal` → `~/.cursor/plugins/local/paypal`). Contract facts below were looked up in the SDK map shipped inside `node_modules/paypal/` (`sdk-map.md`, `map/operations/*.md`) and the source files its tables name — not recalled. Lookup layer: `typescript-getting-started`; workflow: `typescript-integrate-paypal`.

## Scope

`scripts/paypal-verify.mjs` — a read-only verifier: given a public OnPoint receipt id/URL it pulls the receipt, extracts `metadata.paypal.{orderId,captureId,amountUsd,payoutBatchId}`, then independently re-reads those ids at PayPal and reports whether the receipt's claims hold. Judge/operator tooling; writes nothing, never captures, never pays.

Two halves:

1. **SDK half** — `orders.getOrder` + `payments.getCapturedPayment` via the APIMatic `paypal` package (v2.29.0, `git+https://github.com/context-plugins/paypal-typescript-sdk#main`).
2. **REST half** — `GET /v1/payments/payouts/{batchId}` via the existing `apps/api/lib/paypal-payments.js` `getAccessToken`. The generated SDK covers Orders/Payments/Vault/Transaction-Search/Subscriptions only — **Payouts is not in its 40-operation surface**, so the batch lookup stays REST. Documented, not a shortcut.

## Repo survey (read-only)

- Monorepo, pnpm@10.10.0 workspaces (`apps/*`, `packages/*`), Node `>=22` (local v26).
- `scripts/*.mjs` are ESM operator scripts run as `node scripts/x.mjs`; they read env directly and reuse `apps/api/lib/*` via `createRequire`.
- API is CommonJS (`require`/`module.exports`); PayPal REST helper: `apps/api/lib/paypal-payments.js`.
- Receipt payload: `GET {API}/api/receipts/{id}` → `{ receipt: { metadata: { paypal: { orderId, captureId, amountUsd, env, payoutBatchId } }, txHash } }` — `txHash` mirrors the capture id.
- Server binds the order with `custom_id = "tryon:{slug}:{listingId}:{uuid}"` / `"order:{slug}:{listingId}:{size}:{quoteId}"` (`apps/api/routes/agent-tryon.js`, `curator-storefront.js`).
- Toolchain: no build for scripts; check = `node scripts/paypal-verify.mjs <known-receipt>` against production.

## Contract sheet

### Client construction

```ts
new PaypalClient({
  serverOptions: { baseUrl },          // one env only — override is the ONLY host knob
  oauth2: { clientId, clientSecret },  // Bearer token, SDK-cached
  retry: { timeout: 10_000 },          // ms, bounds ONE attempt
})
```

- One environment declared → **no `ServerEnvironment`**; `serverOptions.baseUrl` selects the host. Explicit: `PAYPAL_ENV=live` → `https://api-m.paypal.com`, else `https://api-m.sandbox.paypal.com` (the SDK default is sandbox — we still spell it out so the host is visible).
- `oauth2` unset sends no credential → silent 401 later; factory throws `PAYPAL_CLIENT_ID/SECRET required` first.
- Token endpoint follows the base URL (`default` group + `/v1/oauth2/token`), Basic-auth client credentials.
- Error family `PaypalError`; narrow on `err.kind` — `"api"` arms read `err.payload.kind`; `auth`/`connection`/`timeout` produce no response; `decode` means the answer didn't fit spec. Anything outside the family is rethrown.

### Operations in scope

| Operation | Signature | Wire | Auth | Returns |
|---|---|---|---|---|
| `getOrder` | `getOrder(request: Orders.GetOrderRequest)` | `GET /v2/checkout/orders/{id}` | oauth2 | `Order` |
| `getCapturedPayment` | `getCapturedPayment(request: Payments.GetCapturedPaymentRequest)` | `GET /v2/payments/captures/{capture_id}` | oauth2 | `CapturedPayment` |

Request fields (channel · wire · req):

- `getOrder`: `id` path req · `fields` query · `payPalMockResponse` header · `payPalAuthAssertion` header — **only `id` set**.
- `getCapturedPayment`: `captureId` path req (`capture_id`) · `payPalMockResponse` header — **only `captureId` set**.

Error arms:

- `getOrder` → `Orders.GetOrderError`: `error` 401 · `error2` 404 · `error3` default · `undeclared` rawBody.
- `getCapturedPayment` → `Payments.GetCapturedPaymentError`: `error` 401 · `error2` 403 · `error3` 404 · `error500` 500 (no body) · `error4` default · `undeclared` rawBody.

Model members read from `src/models/`: `Order.status?: OrderStatus` (`CREATED|SAVED|APPROVED|VOIDED|COMPLETED|PAYER_ACTION_REQUIRED…`), `Order.purchaseUnits?: PurchaseUnit[]` (`customId`, `referenceId`, `amount`, `payments.captures[]`); `CapturedPayment.status?: CaptureStatus`, `amount?: Money`, `sellerReceivableBreakdown?`.

### DURABLE WRITES

None — both operations are reads; the script never calls `createOrder`, `captureOrder`, `patchOrder` or the Payouts write path. The only POST is the SDK's own OAuth token fetch and `getAccessToken` (same purpose).

### CROSS-OPERATION INVARIANTS

| Invariant | Legal set | Enforced where | Test |
|---|---|---|---|
| `captureId` on the receipt must exist inside `order.purchaseUnits[].payments.captures[].id` | the order PayPal itself returns | `verifyOrder` loop over units | live receipt `receipt_mwdr4vi4_66d38caf` |
| `custom_id` must start `tryon:`/`order:` and carry the receipt's `listingId` | the reference format the API mints | `verifyOrder` prefix+substring check | same |
| `capture.amount.value` ≈ receipt `paypal.amountUsd`, currency `USD` | the receipt's claim | `verifyCapture` | same |
| `order.status === "COMPLETED"` and `capture.status === "COMPLETED"` | OrderStatus/CaptureStatus enums | same | same |

### OPTIONAL FIELDS

| Field | What requires it | Set? |
|---|---|---|
| `fields` / `payPalMockResponse` / `payPalAuthAssertion` (both ops) | nothing | leave out |
| `serverOptions.baseUrl` | the deployment's own env (`PAYPAL_ENV`) | set — explicit host binding |
| `retry.timeout` | operator tool — bound the wait, keep default retries | 10_000 |

### WHEN THE API SAYS NO (per operation)

| status | script answers | caller reads |
|---|---|---|
| 401/403 | exit 2 | "credentials rejected / not permitted on this app — check PAYPAL_CLIENT_ID/SECRET" |
| 404 | exit 2 | "order/capture not found under this PayPal app — receipt may name a different merchant app" |
| other 4xx/5xx (default arm) | exit 2 | `err.payload`'s reason text |
| connection/timeout on a read | exit 2 | "PayPal unreachable — outcome unknown, retry" |
| `AuthError` on token fetch | exit 2 | "token request refused — bad credentials" (never reports the verify as failed) |

### REQUIRED READING

- MUST load `typescript-error-handling` — loaded (family narrowing, rethrow outside family).
- MUST load `typescript-client-initialization` — loaded (factory pattern, credential check, timeout knob).
- MUST load `typescript-testing` — loaded before the verification run.
- Loaded additionally: `typescript-getting-started` (lookup layer), `typescript-integrate-paypal` (workflow), `typescript-authentication` (oauth2 member, token caching).

### Assumptions & Blockers

- The script needs **this app's** `PAYPAL_CLIENT_ID/SECRET` to re-read our orders — a judge without them still gets the public-receipt half plus the exact commands for their own deployment. No blocker.
- Payout batch lookup is REST because Payouts is absent from the SDK surface (`node_modules/paypal/map/operations/` — no payouts page). Noted here rather than faked.
- Production order/capture paths stay on the proven REST helper this session — this change adds verification tooling, it does not re-platform live code at the deadline.
