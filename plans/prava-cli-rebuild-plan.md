# Plan: Rebuild Prava Client Against Real `@prava-sdk/cli` Contract

## Context

Our `prava-client.js` was built against an idealized spec. The real `@prava-sdk/cli` has a materially different contract at the payment/checkout steps. The discovery steps (search/product/quote) are close but need minor fixes. The payment+checkout steps need a structural fix: the real CLI returns tokenized card credentials (token + cryptogram + expiry) from `sessions poll`, and `shop checkout` requires those as flags — it does NOT take a `--payment-session-id`.

## Real CLI Contract (from official skill docs)

```
prava shop search   --query "..." [--intent "..."] --json     → results[] {product_id, title, price, merchant}
prava shop product  --product-id X --merchant Y --json        → variants[] {variant_id, price, options}
prava shop quote    --variant-id X --merchant Y --yes --json  → {checkout_session_id, total, subtotal, shipping, tax}
prava sessions create --total-amount T --currency USD \
  --merchant-name M --merchant-url U --merchant-country CC \
  --product '{"description":"...","unit_price":"...","quantity":1}'
  → {session_id, payment_url}   (prints URL, human approves in browser)
prava sessions poll --session-id S
  → Token: 4323...  Cryptogram: 957  Expiry: 12/2028   (after human approves)
prava shop checkout --checkout-session-id CS \
  --token 4323... --cryptogram 957 --expiry-month 12 --expiry-year 2028 --yes
  → "✓ Paid" + order_id
```

## What's Wrong Now (precise)

| Function | Current (wrong) | Real CLI |
|----------|-----------------|----------|
| `shopSearch` | `--query q --json` | Same + should add `--intent` |
| `shopProduct` | Correct | OK |
| `shopQuote` | Correct flags, 90s timeout | OK (real quote takes 15-30s) |
| `createPaymentSession` | Correct flags | OK |
| `getPaymentStatus` | `sessions poll` → hardcodes `status: 'completed'` | `sessions poll` blocks up to 10min, returns **token + cryptogram + expiry** (not a status) |
| `shopCheckout` | `--payment-session-id` flag | Needs `--token --cryptogram --expiry-month --expiry-year` |
| Facade `checkout` handler | Checks `result.order_id` | Correct! Real CLI returns order_id on success |
| Facade `poll` handler | Stores nothing from poll | Must store token/cryptogram/expiry on order |
| Linq `handleApproval` | Calls fake `/approve` then `/checkout` | Must call `/poll` (gets creds) then `/checkout` |

## Files to Modify

### 1. `apps/api/lib/prava-client.js` (transport layer)

**`getPaymentStatus` → rewrite as `pollPaymentSession`:**
- Calls `sessions poll --session-id S --json` with a long timeout (10 min)
- Parses `token`, `cryptogram`, `expiry` (MM/YYYY) from result
- Returns `{ session_id, status: 'completed', token, cryptogram, expiryMonth, expiryYear }`
- Self-check fixture returns fake creds immediately

**`shopCheckout` → fix flags:**
- Replace `--payment-session-id` with `--token`, `--cryptogram`, `--expiry-month`, `--expiry-year`

**`shopSearch` → add `--intent` passthrough.**

**Export rename:** `getPaymentStatus` → `pollPaymentSession` (keep old name as alias).

### 2. `apps/api/routes/prava-facade.js` (order state machine)

- Order object gains: `token`, `cryptogram`, `expiryMonth`, `expiryYear` (all null initially)
- `POST /order/:id/poll` stores credentials on success
- `POST /order/:id/checkout` passes stored creds to `shopCheckout`

### 3. `apps/api/routes/linq-agent.js` (iMessage approval flow)

- `handleApproval`: remove `/approve` call; just poll → checkout

### 4. `scripts/prava-demo.mjs` — update to match new flow

### 5. `apps/api/.env.example` — no changes needed

## Setup Sequence (on server, interactive)

```bash
ssh snel-bot "npm install -g @prava-sdk/cli"
ssh snel-bot "prava setup --name 'OnPoint Stylist' --platform custom --description 'OnPoint iMessage fashion agent'"
# → prints link URL; USER opens it in browser + approves
ssh snel-bot "prava setup poll"
# Set PRAVA_AGENT_LINKED=1 in shared/api/.env
ssh snel-bot "pm2 restart onpoint-api --update-env"
```

## Verification

1. `curl /prava/health` → `mode: "live"`, `cliAvailable: true`
2. Real search → real UCP results
3. Self-check demos still pass (no regressions)
4. Full order flow via webhook → confirmed with real `ord_...`

## Order of Operations

1. [DONE — applied before plan mode re-activated] Fix transport (`prava-client.js`):
   `pollPaymentSession` (returns token/cryptogram/expiry), corrected `shopCheckout`
   flags, `shopSearch` `--intent`, `FIXTURE.poll`, exports updated. Self-check still passes.
2. Fix state machine (`prava-facade.js`) — self-check still passes
3. Fix approval flow (`linq-agent.js`) — self-check still passes
4. Update `scripts/prava-demo.mjs` to the new credential flow
5. Run self-check demos → verify no regressions
6. Commit + deploy
7. Install CLI + link agent (interactive, user approves)
8. Set `PRAVA_AGENT_LINKED=1`, restart, verify live
9. (Optional) real test purchase
