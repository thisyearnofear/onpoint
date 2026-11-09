# Trusted-Execution Hardening Plan (2026-11-09)

Implementation plan addressing the critical review of 2026-11-09: payment replay,
self-declared identity, quote/tx binding gaps, non-atomic order flow, migration
drift, rail sprawl, duplicated domain logic, thin test coverage on money paths,
empty supply, and frontend monoliths.

Guiding principle: **the product claim is "the offer is executable, not merely
recommendable."** Every phase below either makes execution honest (money cannot
be double-spent or misattributed), makes the claim provable (tests, data), or
cuts surface that dilutes it (rails, demo inventory).

---

## Phase 0 — Stop the bleeding (this week, no schema changes)

### 0.1 Make the try-on payment claim atomic and leak-free
`apps/api/routes/agent-tryon.js` currently SELECT-checks `payments.txHash`,
renders, then claims with `onConflictDoNothing` — and on a lost race returns
HTTP 409 **with the generated render in the body** (~:440-574). One paid tx hash
buys N renders when parallelized.

- Flip the order: **claim first, render second.**
  1. `INSERT INTO payments (tx_hash, ...) VALUES (...) ON CONFLICT DO NOTHING RETURNING id`
     immediately after payment verification succeeds, status `'processing'`.
  2. If the insert conflicts → 409 with **no render**, only
     `{ error, paymentId, status }`. If the winning request finished, the row
     already carries the render's R2 key; serve it via a "replay my render"
     lookup on `payments.renderKey` (Phase 0.4) instead of re-rendering.
  3. Render; `UPDATE payments SET status='completed', render_key=...` .
  4. On render failure → `status='refunded_or_failed'` and release semantics per
    0.5 (credit ledger entry, not deletion).
- `payments.tx_hash` is already `unique`
  ([packages/db/src/schema/payments.ts:32](../packages/db/src/schema/payments.ts)) —
  no migration needed for the conflict target.
- Delete the "Return the render anyway — the agent got value" branch
  (agent-tryon.js:563-574).
- Same treatment for the OKX facade synthetic-proof path (agent-tryon.js:302-308):
  a `crypto.randomUUID()` proof is un-replayable by construction, which is fine,
  but it must go through the same claim-first gate so future rails inherit it.

**Verification (test, not manual):** vitest concurrency test — fire 5 parallel
try-on requests with the same `paymentTxHash`; assert exactly one 200 with a
render, four 409s with no image bytes in the body.

### 0.2 Fix `link-agent`: stop treating a phone number as a password
`POST /api/looks/curator/:slug/link-agent`
([apps/api/routes/agent-looks.js:928-968](../apps/api/routes/agent-looks.js))
overwrites `curators.linkedAgentAddress` for anyone who guesses a WhatsApp
number, plaintext-compares it (:113-117), behind only a general rate limit. This
is a permanent attribution/payout redirect.

- Require **curator-verified session** for this route, not a header match:
  reuse the Linq client already in `apps/api/lib/linq-client.js` to send a
  6-digit OTP to the stored WhatsApp number; verify OTP server-side
  (hashed, 10-min expiry, max 3 attempts) before any write.
- Compare OTP hashes with `crypto.timingSafeEqual`, never `===`.
- The `agentAddress` being linked must itself be signature-verified (Phase 0.3)
  by the *agent* — linking is a two-sided consent, not one-sided assignment.
- Add a dedicated rate limiter (e.g. 5 OTP sends / phone / hour) and an audit
  row (`curator_link_events`) for every change: who, when, from, to.

### 0.3 Wallet-signature auth for agent identity
`x-agent-address` is trusted with zero proof
([agent-looks.js:90-94](../apps/api/routes/agent-looks.js)) — anyone can edit or
delete any look and view any wallet's dashboard.

- Add a signed-session flow (SIWE-shaped, minimal):
  1. `POST /api/auth/challenge { address, purpose }` → server stores nonce
     (Redis-free: a small `auth_challenges` table, 5-min TTL) → returns message
     to sign.
  2. `POST /api/auth/verify { message, signature }` → `verifyMessage()` (viem)
     → issues a short-lived bearer `op_session` token (JWT, HMAC secret in env).
  3. Middleware `requireAgentSession` replaces the header trust on all
     creator-scoped look routes, `/api/agent/dashboard`, and minting.
- Keep `x-agent-address` accepted **read-only** for attribution display; writes
  and dashboards require the session.
- Curator side keeps WhatsApp+OTP (0.2) as the human path; the curator wallet
  address binds the two.

### 0.4 Render persistence
Store the try-on render R2 key on the `payments` row (`render_key`, nullable
text — one migration, folded into Phase 1.2's migration so we ship one clean
`db push`). Enables "replay, don't re-render" and gives support a lookup path.

### 0.5 Constant-time + info-leak quick wins
- Service-key compare → `timingSafeEqual`
  ([apps/api/server.js:166](../apps/api/server.js)); remove the dev bypass
  (:151-156) from any non-local env.
- `/health` (:190-210) stops listing which integrations are configured — return
  `ok` + version only; move the per-integration detail behind the service key at
  `/api/status/integrations`.
- Wire `cors` (already a dependency) with an explicit allowlist; add `helmet`.

---

## Phase 1 — Make money movement honest (2–3 weeks)

### 1.1 Bind payment transactions to quotes
`packages/agent-core/src/erc20.ts:210-264` sums all matching Transfer logs with
no `from` check; `apps/api/routes/curator-storefront.js:769-780` validates only
quote *age*, and price is re-read live at :628-644 — the tx is never proven to
be *for this quote*.

- On quote issuance, snapshot into the `quotes` row: `amount_due`, `pay_to`,
  `asset`, `chain_id`, `listing_id`, `size`, `expected_payer` (if known).
- Verification becomes: decode the tx → assert **at least one Transfer log with
  `to = pay_to` and `value >= amount_due`**, token address = asset, on chain_id;
  record `from` as the payer identity (this is what referral/self-referral rules
  should key on, not a client-supplied address).
- Order finalization reads price **from the quote snapshot**, never live. If the
  listing price changed after the quote, the order executes at quote price (that
  is what a quote *means*) or is rejected with a "stale quote" error carrying the
  new price.

### 1.2 Collapse the order flow's crash windows
Today: INSERT claim → raw-SQL stock decrement (curator-storefront.js:936-975) →
UPDATE confirm (:1003) → referral INSERT (:1050) → payout (:1113-1155), five
independent writes on Neon HTTP (no interactive transactions), with swallowed
errors at :1062-1068 / :1148-1155.

- **Statement-level atomicity** where transactions are impossible:
  combine claim + stock decrement into one CTE statement:
  `WITH claim AS (INSERT ... ON CONFLICT DO NOTHING RETURNING id) UPDATE
  listings SET sizes = jsonb_set(...) FROM claim WHERE stock_available(...)
  RETURNING ...` — either both effects happen or neither. Move the 40-line
  JSONB blob behind a **SQL function** `decrement_stock(listing_id, size, qty)`
  so the invariant lives in the DB, with a `CHECK`-style guard in the function
  body.
- **Outbox for money after-effects:** referral accrual and payout become rows in
  a `money_events` table (idempotency key = `payment_id + kind`) written in the
  same CTE statement; the existing payout cron drains them with retry + backoff
  and marks `dead_letter` after N attempts instead of logging and forgetting.
  This replaces "swallow with a log line."
- Long-term option (only if 1.2 proves insufficient): evaluate Neon pooled TCP
  connections for the order route specifically. **Explicitly out of scope for
  this plan** — do the atomic-statement + outbox work first.

### 1.3 One migration pipeline, applied on deploy
Two migration dirs exist — `packages/db/drizzle/` (21 generated, loaded by
`migrate.ts:29-31`) and `packages/db/migrations/` (12 handwritten, never
loaded) — and deploys don't run migrations (two recorded prod incidents in
docs/ops/deployment.md).

- Inventory the 12 handwritten files: apply-to-prod-then-absorb (generate an
  equivalent drizzle migration) or delete if already applied.
- Delete `packages/db/migrations/`; `drizzle/` becomes the single source.
- Add a Fly `release_checks`/release command that runs `migrate.ts` before the
  new machine serves traffic; update docs/ops/deployment.md accordingly.
- Extend `scripts/check-db-migrations.mjs` from 3 pinned hashes to: CI job that
  runs `drizzle-kit generate` against a fresh temp DB and fails on any diff
  between schema.ts and committed migrations (real drift detection).

### 1.4 Quote/try-on parity for non-x402 rails that stay
Whichever rails survive Phase 2 must inherit claim-first (0.1) and
quote-binding (1.1) — audit NEAR/PayPal proof handling in agent-tryon.js and
curator-storefront.js at the same time, since 0.1 touches the same code paths.

---

## Phase 2 — Cut the surface (1 week, mostly config + flags)

### 2.1 Rail allowlist; unlaunch what is not live-validated
8+ rails ("implemented, not live-validated") each multiply the attack/bug
surface of Phases 0–1.

- Introduce `PAYMENT_RAILS_ENABLED` (default: `celo-x402` only in production).
  A rail is advertised in `/quote.paymentRails`, the manifest, and AGENTS.md
  **only** when in the allowlist *and* passing its smoke test.
- Keep the code for NEAR/PayPal/OKX behind the flag (hackathon assets exist);
  stop advertising and stop loading their routes when disabled.
- Per rail, add `docs/rails/<name>.md` stating exactly what was live-validated,
  when, and by which transaction — feeding the status legend in AGENTS.md.
- OKX facade self-check mode stays (it's a marketplace listing requirement) but
  `/okx/health` and the manifest must not imply settlement is verified.

### 2.2 Single source of truth for shared domain logic
`kesToCusd` (and pricing generally) exists in both
`apps/api/lib/agent-commerce.js` and
`apps/web/app/api/agent/checkout/route.ts` — two implementations that drift
silently.

- Extract currency/pricing/quote helpers into `packages/pricing` (TS, tested);
  apps/web imports it; apps/api requires it (the repo already mixes JS/TS via
  built packages — follow the existing `@repo/*` pattern).
- Follow-on: audit the 106 `apps/web/app/api/*/route.ts` files for other
  duplicated domain logic and move those helpers into `@repo/*` packages too.
  Do not attempt a wholesale web↔api merge in this plan.

### 2.3 Type the money paths, not the monolith
`apps/api` is plain JS. Converting 124 files is out of scope; instead port the
*payment-critical* units to TS inside `packages/` where they're testable:
pricing (2.2), payment verification (agent-core already TS), quote lifecycle.
The route files stay JS but shrink to orchestration.

---

## Phase 3 — Prove it (continuous, but gates Phase 2's flags)

### 3.1 Money-path integration tests (the acceptance gate for Phases 0–1)
- Replay: 5 parallel requests, one tx hash → exactly one render (0.1 test).
- Quote binding: tx that pays `payTo` but wrong amount / wrong token / wrong
  recipient → rejected with specific reasons (1.1).
- Authz matrix: every creator-scoped route gets a "second user must be refused"
  test once `requireAgentSession` lands (0.3), including link-agent OTP abuse
  cases (0.2).
- Stock atomicity: concurrent orders for the last unit → one 201, one 409,
  stock never negative (1.2).
- Outbox: kill the request between order-confirm and referral-insert (simulate
  by failing the first drain) → cron settles exactly once (1.2).

Run these against a real postgres in CI (testcontainers or a CI service);
current vitest-only coverage of 41 files / 124 sources is the gap being closed
where it matters, not everywhere at once.

### 3.2 Contract tests against the OpenAPI spec
CI job: spin up apps/api, walk `apps/web/public/openapi.json`, assert every
documented endpoint answers with the documented shape (including 402 challenge
structure for try-on/order). Closes the "docs drift from reality" risk without
hand-written duplicate specs.

### 3.3 Money-movement observability
Structured metric per hop: quote issued → payment verified → claim → stock
decremented → order confirmed → referral accrued → payout settled, all keyed by
`quoteId`. A weekly reconciliation script (extend
`scripts/trusted-offer-audit.mjs`) diffs `payments` vs chain vs orders and
alerts on `manual_review` rows older than 24h. This is what turns
"implemented" into evidence for the status legend.

---

## Phase 4 — Supply and experience (parallel track, product effort)

### 4.1 Ten merchants with real SKUs (the actual growth constraint)
`agentPurchasable=1` currently returns **one curator, one SKU**; the trusted-offer
machinery has nothing to execute against.

- Run the existing merchant-onboarding scorecard
  (docs/ops/merchant-onboarding-scorecard.md) against the 7 inactive + 24
  remaining beta curators; target: **10 curator storefronts with ≥5 live
  agent-purchasable SKUs each by end of Phase 2 timeframe**.
- `GET /api/status/funnel` and a new `supply_health` gauge (live SKUs,
  trusted-attribute coverage, price freshness) surfaced in the weekly pilot
  report — supply, not features, is the metric.
- Listing readiness: make the attributes backfill (rule-based extractor) a
  required step of ingest so every new SKU is filterable and outfit-planner
  eligible on day one; no demo items without attributes.

### 4.2 Show real inventory first on the consumer surface
The home feed ("Showing 12 of 37") leads with Graphic 01-03 studio demos.

- Sort/segment the feed so **purchasable live listings rank above studio
  demos**; demos get a visible "sample" treatment and are excluded when the
  user filters to "Work/Going out/Layers" occasions.
- Keep the closet/try interactions — they're the app's best asset — but every
  "Get a verdict / shop this" exit from a demo item should land on real
  inventory when any exists for that occasion.

### 4.3 Frontend decomposition and a11y (opportunistic, per-touch)
- Split `components/VirtualTryOn/LiveStylistView.tsx` (1417),
  `AgentStatus.tsx` (1196), `VirtualTryOn.tsx` (1152) only when touched by a
  feature — extract presentational subcomponents + one state hook each; no
  big-bang rewrite.
- Do one dedicated a11y sweep now: add `alt` to the 8+ raw `<img>` sites
  (starting `app/gift/[token]/page.tsx:45`, `components/surface/ItemRow.tsx:15`),
  add `alt=""` where decorative; enable `eslint-plugin-jsx-a11y` (or the
  Next.js equivalent rule set) at "error" for `img-alt` so regressions are
  impossible.

---

## Order of execution & dependencies

```
0.1 ──┐
0.2 ──┼─► (nothing depends on these; ship independently, all this week)
0.3 ──┤   NOTE: 0.2 and 0.3 land together for link-agent (two-sided consent)
0.5 ──┘
1.1 ──► 1.2 (outbox keyed on verified payment) ──► 1.3 migration work folds in 0.4 column
2.1 needs 0.1+1.1+1.4 on the surviving rail (celo-x402) before defaulting others off
2.2 ──► 3.2 (contract tests assert the shared pricing shape)
3.1 gates the Phase 2 flag flips; 3.3 gates any "live-validated" status upgrade
4.1/4.2 run in parallel from day one (product track, no code blockers)
4.3 opportunistic + one a11y sweep this month
```

**Definition of done for the whole plan:** the five money-path test classes in
3.1 pass in CI; `PAYMENT_RAILS_ENABLED=celo-x402` in production; zero routes
accept a self-declared `x-agent-address` for a write; `drizzle/` is the only
migration dir and deploys apply it; ten curators with real SKUs on the
directory; home feed ranks purchasable inventory above demos.

## Explicitly deferred (do not fund yet)
- Web↔API monolith merge / full TS conversion of `apps/api`.
- Interactive-transaction re-platforming (pooled TCP, single DB lib).
- Any new payment rail, any new hackathon facade.
- Curator activation tooling beyond the onboarding scorecard run (ADR 0023
  already defers curators; this plan only fixes the auth hole they use).
- K-factor / share-attribution features — measurement exists, claims don't;
  revisit only after 4.1 supplies inventory worth sharing.
