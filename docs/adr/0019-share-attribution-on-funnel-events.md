# ADR 0019: Share Attribution on `funnel_events`

**Status**: Accepted
**Date**: 2026-10-09
**Related**: ADR 0010 (agent storefront checkout), ADR 0013 (pricing and revenue model), ADR 0018 (x402-first monetization)

## Context

Look collages and polaroids are the shareable surface, and referral commissions reward agents who drive purchases. Nothing connected a share to a visit, try-on, or order, so any claim about a "growth loop" or K-factor had no measurement behind it. A code audit also found that the web share button never recorded a share, `/r/[code]` visits were dropped, and the storefront ignored the `referral` and `look` URL parameters.

## Decision

1. **Reuse `funnel_events`; add no table.** Share events are rows with `event_type` `look_share`, `look_visit`, `look_cta`, or `look_storefront` (with `metadata.kind`), keyed by `metadata.shareId`. Downstream `tryon_complete` and `purchase` events carry `metadata.shareId`. No migration was needed.
2. **A share id is minted per share action**, 6–16 lowercase alphanumerics, travelling as `?sid=` with `?utm_source=` for the channel. The web client mints it so the URL can be built inside the click gesture; the server validates and never trusts it.
3. **`sale` is recorded server-side only.** The public `/storefront` endpoint accepts `arrive`, `tryon`, `buy`, `order` (client-reported intent). A confirmed sale is written by `POST /api/orders/record` after Safaricom's callback, once per M-Pesa receipt, so a client cannot fabricate one.
4. **Activation is defined, and arrival alone does not count.** A share is activated by a non-sharer look CTA click, a storefront try-on/buy/order/sale, a web or agent try-on, or an agent order. Intent and outcome are reported separately.
5. **K-factor = invites per sharer × activation rate**, reported as `null` / `insufficient_data` below 30 shares. No growth claim is made from a smaller sample.
6. **Privacy by construction.** Events store `sha256(salt | day | ip | ua)` truncated, never the IP or user agent. The hash is day-scoped, so it cannot link a visitor across days.
7. **Self-activity is excluded** when an event's actor matches the sharer's. Referral commissions are skipped when the payer is the referring agent.

## Consequences

- Measurement is cheap and reversible: the data is ordinary rows, and the report is one query plus a pure aggregation (`apps/api/lib/share-attribution.js`, unit-tested).
- Attribution is **best effort**. It uses `sessionStorage` (lost across tabs or browsers), a day-scoped hash (a returning visitor looks new), and client-supplied ids (a valid forged id can attribute a sale to another share). Per-share numbers are analytics, never a basis for payouts.
- Human attribution ends at confirmed M-Pesa STK sales. Manual M-Pesa codes and WhatsApp-only sales are invisible until they gain a confirmation path.
- The storefront still ignores the `referral` parameter, so human purchases earn no commission.
- Operating details and definitions live in [ops/growth-loop.md](../ops/growth-loop.md); the agent-facing contract is in `AGENTS.md` (Share Attribution) and `apps/web/public/openapi.json`.
