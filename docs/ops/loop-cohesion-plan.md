# Loop Cohesion Plan — closing the attribution and delight gaps

> Status: **in progress**. Companion to [growth-loop.md](./growth-loop.md) (metric definitions) and [invite-flow-teardown.md](./invite-flow-teardown.md) (funnel audit). This doc tracks the fixes; growth-loop.md stays the source of truth for definitions.

## Problem statement

The viral hooks feed one instrumented pipe (`funnel_events`), but real sharing behavior escapes it: artifact shares (polaroids, couple cards, gifts) minted a `sid` that never reached the server as a share event, arrivals on `/p/{id}` reported no visit, client-minted sids are bearer tokens (forgeable in principle), and retention surfaces are not all wired to end in try-on / save / share / purchase.

## Phase 1 — Close the attribution leaks

- [x] **1.1 Artifact shares join the funnel.** `ShareArtifact` now sends the minted `sid` with `artifact_shared`; `POST /api/loop/event` mirrors it into a `look_share` funnel row (and `artifact_visit` → `look_visit`) so artifact shares count in `GET /api/status/funnel/share` under overall/byChannel. `/p/{id}` mounts `PolaroidTracker`, which captures `?sid=`, binds it to a synthetic `p-<id>` look key (so `getAttributionFields()` emits `shareId`+`lookSlug` on downstream try-on/order calls), and reports the visit. `PolaroidGetItLink` already forwarded `sid` to the storefront.
  - Files: `apps/web/components/ShareArtifact.tsx`, `apps/web/app/p/[id]/{page,PolaroidTracker}.tsx`, `apps/api/routes/loop.js`
  - Note: this covers sid-*linked* shares. A **screenshot of the rendered image** still carries no URL — true screenshot attribution would need the short-code-on-image work below (see Remaining).
- [~] **1.2 Unforgeable sids — existence-verified, not signed.** Sids are minted client-side, so HMAC signing is impossible without a server roundtrip per share or a format change (`sid.sig`). Implemented instead: `shareExists(db, shareId)` in `lib/share-attribution.js` verifies a `look_share` row exists before the M-Pesa sale join in `POST /api/orders/record` stamps attribution — forged/guessed ids can't attach to orders. The funnel aggregator already drops downstream events for unknown shares, so analytics forgery was never able to inflate K. Residual: a *real* sid is a bearer token — someone holding a shared link can reuse it; acceptable for analytics-grade attribution.
  - Files: `apps/api/lib/share-attribution.js`, `apps/api/routes/fulfillment.js`
  - Remaining (optional hardening): server-minted signed sids if attribution ever gates money.
- [x] **1.3 Off-platform sale capture.** Verified the chain already existed end-to-end: `stk-push` stores `shareId`/`lookSlug`/`referralCode` on the pending payment → `stk-callback` → `recordOrderInLedger` → `POST /api/orders/record` (idempotent on M-Pesa receipt, order row keeps `referralCode` attribution-only, sale funnel event carries `shareId`+`orderId`). Added: sale attribution now requires `shareExists` (1.2), and the curator's STK-confirmed notification names the driving look (`via shared look /look/{slug}`). Human referral commissions remain **attribution-only** — orders store `referral_code`, no commission is created; flipping to paid is a payout-job decision, not a schema change.
  - Files: `apps/web/lib/utils/notifications.ts`, `apps/api/routes/fulfillment.js`
  - Remaining: a WhatsApp order-confirm *template* to the buyer/curator preserving the storefront link — needs a send-rail decision (Linq is iMessage-only today).

## Phase 2 — Delight reconciliation

- [x] **2.1 Next-action audit.** Closet verified end-to-end: empty state → add piece → plan lookbook → Share issue / Restyle / "Try a pick on yourself" exits, per-item "Shop this piece" links. Fixed a dead share: the closet issue share carried text only — no URL, so recipients had no door. Now passes `url` (native share) / appends origin (clipboard). Runway fixes deep-link into try-on; saved try-ons keep all four exits; G$ streak is a curator-side token loop (separate funnel, not consumer retention).
- [~] **2.2 Funnel events for retention (started).** Added `closet_add` and `closet_plan` event types to `POST /api/loop/event`; `ClosetSection` fires them on add/plan. Still to add if wanted: streak-milestone, runway-claim, save/share-from-result events.

## Phase 3 — Supply density (ops runbook)

These write to the production catalog — run deliberately, not from a feature branch:

- [ ] `node scripts/backfill-listing-attributes.mjs` (then `--cutouts` once `GARMENT_CUTOUT_ENABLED=1` + OpenAI key are set) so storefront attribute filters have data.
- [ ] Agent-look generation pass per curator to thicken `studio` looks (`scripts/agent-looks.mjs create`).
- [ ] Curator activation remains deferred per [ADR 0023](../adr/0023-consumer-engine-first-curators-deferred.md). Studio/agent content is not live merchant supply — keep labels honest.

## Phase 4 — Brand coherence

- [x] **Provenance labels audited.** `LookCard` already renders "OnPoint studio" / "From {slug}"; `/s/{slug}` and `/shop` carry the studio-sample-stock demo notes; try-on results carry the "AI Similar-Look Preview" badge. Gap found and fixed: `/look/[slug]` never rendered provenance — studio and real-curator looks were indistinguishable on the artifact page itself. Now the meta line leads with "OnPoint studio ·" or "From {slug} ·".
  - Files: `apps/web/app/look/[slug]/page.tsx`

## Remaining / deferred

- **Short-code-on-image**: printing `onpoint.trustfall.xyz/l/{code}` into the polaroid *image itself* + a `/l/[code]` resolver is the only way to make raw screenshots followable. `/p/{id}` already gives every polaroid a canonical URL; the image-baked code is a renderer change (sharp composite footer) + a code→id lookup table. Deferred — the sid spine now covers link shares; screenshots remain the known blind spot.
- **WhatsApp order-confirm template**: needs a send rail decision.
- **P2 remainder + P3**: retention-surface audit completion, retention funnel events, and the supply backfill/generation runs are pending — see checkboxes.

## Verification

- `npm run check-types` (apps/web): clean. `node --check` on touched API files: clean. `lib/share-attribution.test.js`: 18/18 pass. `share-artifact.test.tsx`: 2/2 pass.
- Live proof pending deploy: `GET /api/status/funnel/share` should show artifact shares (`lookSlug` null or `p-*`) in byChannel once real shares occur; a forged `shareId` on `/api/orders/record` should produce no `kind:'sale'` funnel row.
