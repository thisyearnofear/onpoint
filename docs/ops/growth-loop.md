# Growth Loop: Look Shares and K-Factor

> Status: **implemented, not yet measured.** The instrumentation exists; no K-factor claim is supported until `GET /api/status/funnel/share` reports `status: "measured"` on real traffic.

Look collages and polaroids are the shareable surface. A share is only a growth loop if it can be followed to a downstream action, so every share carries an id.

## Flow

```
share  →  look visit  →  CTA click  →  storefront arrive  →  try-on / buy / order click   (humans)
                                                         →  agent try-on  →  agent order   (agents)
look_share  look_visit    look_cta      look_storefront(kind)                 tryon_complete / purchase
```

1. **Share.** `ShareBar` mints a share id (`sid`, 12 hex chars) per click, builds `…/look/:slug?sid=<sid>&utm_source=<channel>`, and `POST /api/looks/:slug/share` records `look_share`.
2. **Visit.** `LookTracker` reads `sid` / `utm_source`, stores them in `sessionStorage`, and `POST /api/looks/:slug/visit` records `look_visit` (once per session per look).
3. **CTA.** Clicks on `data-look-cta="tryon|shop"` record `look_cta` via `POST /api/looks/:slug/cta`. The `sid` is forwarded in the CTA link query string.
4. **Storefront (humans).** The CTA link carries `sid` and `look`. `CuratorTracker` stores them for the session and records `look_storefront` events via `POST /api/looks/:slug/storefront` with `kind` = `arrive` (once per session), `tryon` (click on "Try with AI"), `buy` (click on an external checkout link), or `order` (M-Pesa STK push sent or manual payment submitted).
5. **Web try-on and confirmed sale (humans).** The stored `sid` + `look` are sent with the web try-on request (`data.shareId` / `data.lookSlug` → `tryon_complete`, source `web`) and with the M-Pesa STK push / manual payment body. The STK push stores them on the pending payment; when Safaricom confirms, the callback passes them to `POST /api/orders/record`, which records a `look_storefront` event with `kind: 'sale'` **server-side, once per M-Pesa receipt**. Clients cannot emit `sale` through the public endpoint.
6. **Agent try-on / order.** Agents pass `shareId` in the `POST /api/agent/try-on` body and `X-Share-Id` (or `?sid=`) on `POST /api/curator/:slug/order`. These land in `funnel_events.metadata.shareId`.

All events live in the existing `funnel_events` table (`metadata` JSON); there is no separate share table.

## Channels

`copy`, `native`, `twitter`, `whatsapp`, `chatgpt`, `agent`, `direct`, `other`. Unknown values map to `other`.

## Definitions

| Term                | Definition                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Share               | A distinct `shareId` with a `look_share` event                                                      |
| Sharer              | Distinct `COALESCE(payer_address, visitor_hash)` on those share events                              |
| Visited share       | A share with at least one `look_visit` from a non-sharer                                            |
| Activated share     | A share with a non-sharer `look_cta`, storefront `tryon` / `buy` / `order` / `sale`, `tryon_complete` (web or agent), or agent `purchase`. Storefront `arrive` alone does not count |
| Invites per sharer  | shares ÷ sharers                                                                                    |
| Conversion          | activated shares ÷ shares                                                                           |
| K                   | invites per sharer × conversion                                                                     |

K is `null` with `status: "insufficient_data"` until there are at least 30 distinct shares in the window. K ≥ 1 would mean each sharer produces at least one activated share on average; below 1 the loop amplifies but does not sustain itself.

## Reading the numbers

```bash
curl -H "Authorization: Bearer $SERVICE_API_KEY" \
  "https://api.onpoint.famile.xyz/api/status/funnel/share?days=7"
```

Returns `overall`, `byChannel`, and `byLook` (top 20), each with stage counts and its own `k` block. Auth is the service key middleware (`x-service-key: …` or `Authorization: Bearer …`).

## Known limits

- **Click and intent events are not outcomes.** Storefront `tryon` / `buy` / `order` are clicks or payment starts. Outcomes are `tryon_complete` and `confirmedSales` (`sale`). Report them separately from intent in the weekly report.
- **Confirmed sales cover M-Pesa STK push only.** Manual M-Pesa code submissions are stored with the share id but stay `pending_verification` and have no confirmation path, so they are not counted as sales. WhatsApp-only and off-platform sales are not attributed.
- **Web try-on attribution depends on `sessionStorage`.** It survives storefront → `/lab` in the same tab; a new tab or browser loses it. Self-exclusion for web try-ons uses the day-scoped visitor hash, which may not match when the share and try-on reach the API through different paths.
- **Share ids are client-supplied.** A forged but valid `sid` of an existing share can attribute a sale to it. Treat per-share numbers as analytics, not as grounds for paying anyone.
- The storefront reads `sid` and `look` but still ignores the `referral` query param; human purchases earn no referral commission.
- Visitors are identified by a salted, day-scoped hash, so one person returning on another day counts as a new visitor.
- Self-activity is excluded when the actor id matches the sharer's. Different devices of the same person are not detected.
- The 2.5% referral commission is separate from share attribution. Referral commissions are skipped when the payer is the referring agent (`isSelfReferral`).

## Privacy

No raw IP address or user agent is written by the share/visit/CTA events. `visitor_hash` is `sha256(salt | day | ip | ua)`; set `VISITOR_HASH_SALT` in production.

## Code map

| Concern                 | Location                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| Helpers, K math         | `apps/api/lib/share-attribution.js` (tests alongside)                     |
| Event endpoints         | `apps/api/routes/agent-looks.js` (`/share`, `/visit`, `/cta`)             |
| Share funnel report     | `apps/api/routes/funnel-analytics.js` (`/share`)                          |
| Client helpers          | `apps/web/lib/utils/share-attribution.ts`                                 |
| Share + tracking UI     | `apps/web/app/look/[slug]/ShareBar.tsx`, `LookTracker.tsx`                |
| Storefront attribution  | `apps/web/components/CuratorTracker.tsx`, `apps/web/app/s/[slug]/MpesaPaymentPanel.tsx` |
| Payment → ledger join   | `apps/web/app/api/curator/stk-push`, `stk-callback`, `apps/api/routes/fulfillment.js` (`/record`) |
| Web try-on attribution  | `apps/web/components/VirtualTryOn.tsx`, `packages/ai-client/src/hooks.ts`, `apps/api/routes/ai-virtual-tryon.js` |

See also: [referral tracking](../guides/referral-tracking.md), [invite-flow teardown](./invite-flow-teardown.md), [weekly pilot report](./weekly-pilot-report.md).
