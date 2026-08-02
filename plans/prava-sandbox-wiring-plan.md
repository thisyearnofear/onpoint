# Plan: Wire Prava REST Sandbox into the Facade Order Machine

## The Decisive Fact

Prava's own docs state plainly: **"Prava Pay (CLI) has no separate sandbox host. The CLI talks to the live API; agent-linked payments use real cards. Sandbox environments apply to the SDK/API integration path."**

The test card (`4622 9431 2323 2523`) only works on the **REST sandbox** (`sandbox.api.prava.space` + `sk_test_*`). The CLI path (which we've been building) can only do real-card production. So "get sandbox working" means wiring the REST payment API into our order flow.

## What Already Exists (and Works)

- `prava-sandbox.js`: fully implemented REST transport (`POST /v1/sessions`, `GET /v1/sessions/:id/payment-result`, `POST /v1/sessions/:id/report-status`). Just needs `PRAVA_SECRET_KEY=sk_test_*`.
- `prava-facade.js`: order state machine (search → product → quote → session → poll → checkout → confirmed).
- `AgentCheckoutCard.tsx`: renders order states, polls every 3s. Has `paymentUrl` in its type but never renders it.
- `prava-card.js` (iMessage): already renders `paymentUrl` as a link.
- Sandbox endpoint confirmed reachable: `https://sandbox.api.prava.space/health` → 200 OK.

## What's Missing (the Gap)

1. **Sandbox is disconnected from the facade** — separate sessions Map, no import, no wiring.
2. **AgentCheckoutCard never renders `paymentUrl`** — judges can't click through to Prava's hosted card entry.
3. **`/prava/order/:id/poll` not proxied** in next.config.js.
4. **AgentCheckoutCard never calls `/poll`** — its `handleApprove` only hits `/approve` (self-check only).
5. **No `sk_test_*` key** on the server.

## The Architecture: Hybrid (CLI for Discovery, REST for Payment)

The CLI's search + product steps work fine against production UCP (discovery is free, no payment). The **quote** step is what needs a delivery address (the blocker). The REST sandbox has no quote concept — it's a payment session API. So:

| Step | Transport | Why |
|------|-----------|-----|
| Search | CLI (production UCP) | Works, free, no payment |
| Product | CLI (production UCP) | Works, free, no payment |
| Quote | **Skip** — use product price directly | CLI quote needs delivery address; REST has no quote |
| Payment session | **REST sandbox** (`POST /v1/sessions`) | Test card works here |
| Poll (card entry) | **REST sandbox** (`GET /v1/sessions/:id/payment-result`) | Returns token+cvv when cardholder completes |
| Checkout | **REST sandbox** (`POST /v1/sessions/:id/report-status`) | Reports APPROVED → completed |

Mode detection: if `PRAVA_SECRET_KEY` is set (starts with `sk_test_`), the facade uses REST sandbox for payment steps. If not, falls back to CLI/self-check as before.

## Changes

### 1. `apps/api/lib/prava-client.js` — Add REST sandbox transport

Add three new functions alongside the existing CLI ones:

```js
// REST sandbox transport (activated when PRAVA_SECRET_KEY is set)
const REST_SECRET = process.env.PRAVA_SECRET_KEY;
const REST_BASE = REST_SECRET?.startsWith('sk_live_')
  ? (process.env.PRAVA_PRODUCTION_BASE || 'https://api.prava.space')
  : (process.env.PRAVA_SANDBOX_BASE || 'https://sandbox.api.prava.space');

function restMode() { return !!REST_SECRET; }

async function restCall(method, path, body) {
  const r = await fetch(REST_BASE + path, {
    method,
    headers: { Authorization: 'Bearer ' + REST_SECRET, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) throw new PravaError('rest_error', `Prava REST ${method} ${path} failed ${r.status}: ${text}`);
  return json;
}

async function createRestSession({ totalAmount, currency, merchantName, merchantUrl, merchantCountry, products }) {
  const r = await restCall('POST', '/v1/sessions', {
    user_id: 'onpoint_agent',
    user_email: 'agent@onpoint.famile.xyz',
    total_amount: String(totalAmount),
    currency,
    integration_type: 'full_checkout',
    callback_url: process.env.PUBLIC_BASE_URL || 'https://beonpoint.netlify.app/agent',
    purchase_context: [{
      merchant_details: { name: merchantName, url: merchantUrl, country_code_iso2: merchantCountry },
      product_details: products,
    }],
  });
  return { session_id: r.session_id, payment_url: r.iframe_url, session_token: r.session_token, order_id: r.order_id };
}

async function pollRestSession({ sessionId }) {
  const r = await restCall('GET', `/v1/sessions/${sessionId}/payment-result`);
  if (r.status === 'awaiting_result' || r.status === 'completed') {
    const li = r.transactions?.[0]?.line_items?.[0];
    if (li?.token) {
      return { session_id: sessionId, status: 'completed', token: li.token, cryptogram: li.dynamic_cvv, expiryMonth: li.expiry_month, expiryYear: li.expiry_year };
    }
  }
  if (r.status === 'failed') return { session_id: sessionId, status: 'failed' };
  return { session_id: sessionId, status: 'pending' };
}

async function reportRestSession({ sessionId, txnRefId, status }) {
  return restCall('POST', `/v1/sessions/${sessionId}/report-status`, { txn_ref_id: txnRefId, txn_status: status });
}
```

Export: `restMode`, `createRestSession`, `pollRestSession`, `reportRestSession`.

### 2. `apps/api/routes/prava-facade.js` — Sandbox-aware order flow

**POST /order**: When `prava.restMode()`, skip the CLI quote step (use product price as total), call `prava.createRestSession()` instead of `prava.createPaymentSession()`. Store `order.paymentUrl = session.payment_url` (the iframe_url). Store `order.restMode = true`.

**POST /order/:id/poll**: When `order.restMode`, call `prava.pollRestSession()` instead of `prava.pollPaymentSession()`. Same credential storage logic.

**POST /order/:id/checkout**: When `order.restMode`, call `prava.reportRestSession({ sessionId, txnRefId, status: 'APPROVED' })` instead of `prava.shopCheckout()`. On success, set `order.orderIdPrava = order.pravaOrderId` (from session creation). Flip to confirmed.

**GET /health**: Add `restMode` field.

### 3. `apps/web/next.config.js` — Add poll proxy

Add: `{ source: '/prava/order/:id/poll', destination: \`${hetzner}/prava/order/:id/poll\` }`

### 4. `apps/web/components/Agent/AgentCheckoutCard.tsx` — Render payment link + poll

**Render paymentUrl**: When `canApprove && order.paymentUrl`, render an "Approve with passkey →" link button (`<a href={order.paymentUrl} target="_blank" rel="noopener">`). Keep the existing approve button as fallback for self-check.

**Add poll to polling loop**: In `doPoll`, when state is `awaiting_approval` or `try_on_ready`, POST to `/prava/order/${orderId}/poll` before the GET. This detects the cardholder's completion and flips state to approved. Then auto-trigger checkout.

### 5. Server env — Set `PRAVA_SECRET_KEY`

User provides `sk_test_*` from dashboard.prava.space. Set on server via SSH stdin. Restart PM2.

## What Does NOT Change

- `prava-sandbox.js` — stays as-is (standalone REST endpoint, service-key gated). We reuse its *pattern* in prava-client.js but don't import it.
- `prava-card.js` (iMessage card) — already renders `paymentUrl`. Zero changes.
- `linq-agent.js` — the webhook flow already calls poll → checkout. With restMode, those calls route to REST. Zero changes.
- CLI path — untouched. When `PRAVA_SECRET_KEY` is unset, everything falls back to CLI/self-check as before.
- Self-check demos — still green (restMode is false when no key).

## Verification

1. `curl /prava/sandbox/health` with service key → `mode: "sandbox-rest"`, `secretKeyConfigured: true`
2. `curl /prava/health` → `restMode: true` (or `mode: "live"` with `transport: "rest-sandbox"`)
3. `curl -X POST /prava/order -d '{"query":"black legging"}'` → returns order with `paymentUrl` = real `sandbox.collect.prava.space?session=...` URL
4. Open `paymentUrl` in browser → Prava hosted card entry page loads
5. Enter test card `4622 9431 2323 2523` / `988` / `12/27` + passkey
6. Card's poll detects completion → state flips to approved → auto-checkout → confirmed
7. `GET /prava/orders/recent` shows the confirmed order → activity feed renders it as "Live"
8. Self-check demos still pass: `node scripts/prava-demo.mjs` (restMode off)

## Execution Order

1. Get `sk_test_*` from user (dashboard.prava.space → API Keys)
2. Implement prava-client.js REST functions
3. Implement prava-facade.js sandbox-aware branches
4. Add next.config.js poll proxy
5. Add AgentCheckoutCard paymentUrl render + poll
6. Syntax check + self-check demos (must stay green)
7. Commit
8. Set `PRAVA_SECRET_KEY` on server + deploy
9. Verify live sandbox flow end-to-end
10. Optional: record demo video of the full flow
