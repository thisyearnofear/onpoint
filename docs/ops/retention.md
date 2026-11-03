# Retention and Engagement Metrics (Phase 0)

> Status: **definitions only. Partly instrumented, not yet measured.** No retention figure is claimed until it is computed from real traffic with the identifiers below.
> Strategy and targets: [STRATEGY.md §7 Phase 0](../STRATEGY.md#phase-0--consumer-engine-and-retention-current) · Decision: [ADR 0023](../adr/0023-consumer-engine-first-curators-deferred.md)

## Player identity

- **Web player:** the anonymous `runway:playerId` UUID in local storage, sent to the API as `playerId`. Engine chat id: `web:{uuid}`.
- **iMessage player:** the chat id from the Spectrum adapter.
- A player is counted per device or browser. Clearing storage or switching devices counts as a new player.

## Definitions

| Metric | Definition |
| --- | --- |
| Started round | A `runway_start` event |
| Submission rate | `runway_submit` ÷ `runway_start`, same round id |
| Second-round rate | Players with ≥ 2 `runway_start` ÷ players with ≥ 1, in the window |
| D1 / D7 return | Players first seen on day 0 who start a round on day 1 / any of days 1–7, ÷ day-0 cohort (UTC days) |
| Weekly active players | Distinct players with ≥ 1 `runway_start` in the ISO week |
| Share rate | Result shares ÷ verdicts (`runway_verdict`) |
| Share-to-player | New players whose first round came from a `/runway/r/:roundId` share page ÷ shares |
| Fix visit rate | Fix link visits ÷ `runway_fix` |

## Current instrumentation (as of 2026-11-03)

| Event | Emitted | Gap |
| --- | --- | --- |
| `runway_start`, `runway_submit`, `runway_verdict`, `runway_fix`, `runway_refused`, `runway_unavailable` | `apps/api/lib/runway/engine.js` (`source: 'runway'`, `metadata.surface` = `web` or `imessage`) | **No player id in metadata.** Cohorts, D1/D7 and second-round rate cannot be computed until a hashed player id is added. |
| Result share | Not emitted | Web share (`RunwayPlay` "Challenge a friend") records no event |
| Share page visit → new round | Not emitted | `/runway/r/:roundId` does not tag the next round as share-referred |
| Fix visit | Via the ADR 0019 share funnel (`sid` on the fix link) | Works for looks, but has no Runway-specific breakdown |

Before claiming any metric:

1. Add a hashed player id (`sha256(salt | chatId)`, not the raw UUID) to every Runway funnel event.
2. Emit `runway_share` with `channel` (`native`, `copy`, `instagram`, `tiktok`, `x`, `whatsapp`, `imessage`, `other`).
3. Carry `ref=<roundId>` from the share page into the next `POST /api/runway/rounds` and record it on `runway_start`.
4. Add a report endpoint, or extend `GET /api/status/funnel`, to return the table above.

## Privacy

Player ids are anonymous and are hashed before storage. No photo, IP address or user agent is stored, as set out in ADR 0022 §5.
