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

## Current instrumentation (as of 2026-11-04)

| Event | Emitted | Gap |
| --- | --- | --- |
| `runway_start`, `runway_submit`, `runway_verdict`, `runway_fix`, `runway_refused`, `runway_unavailable` | `apps/api/lib/runway/engine.js` (`source: 'runway'`, `metadata.surface` = `web` or `imessage`) | `metadata.playerHash` = first 16 hex of `sha256(RUNWAY_PLAYER_SALT|chatId)` is attached on every event. Raw chat ids / web UUIDs are never stored. |
| Result share | `runway_share` via `POST /api/runway/rounds/:roundId/share` (`{ channel, playerId }`; channels `native, copy, download, instagram, tiktok, x, whatsapp, imessage, other`) | — |
| Share page visit → new round | `ref` on `runway_start` | `POST /api/runway/rounds` accepts `ref=<roundId>`; recorded only when the round id is valid 12-hex AND `runwayState.getResult(ref)` exists. `ref` also powers the duel flow (`?ref=` → opponent load + versus card); duel completions are not yet a distinct event — a duel player looks like any other referred round |
| Fix visit | Via the ADR 0019 share funnel (`sid` on the fix link) | Works for looks, but has no Runway-specific breakdown |
| Report | `GET /api/runway/metrics?days=14` (`serviceKeyAuth`, same guard as `/api/status/funnel`) | Cohort math is windowed — `cohortWindowCaveat: true` in the response |

Before claiming any metric:

1. ~~Add a hashed player id~~ — done (`lib/runway/player-hash.js`, first 16 hex of `sha256(salt|chatId)`).
2. ~~Emit `runway_share` with `channel`~~ — done (`POST /api/runway/rounds/:roundId/share`).
3. ~~Carry `ref=<roundId>`~~ — done (`POST /api/runway/rounds` body `ref`, verified against stored results).
4. ~~Report endpoint~~ — done (`GET /api/runway/metrics`, `serviceKeyAuth`).
5. **Still required:** compute real figures from traffic — no retention or share figure is claimed yet. Historical events before this instrumentation have no `playerHash` and are excluded from player-based metrics (counted under `eventsWithoutPlayerHash`).

## Privacy

Player ids are anonymous and are hashed before storage. No photo, IP address or user agent is stored, as set out in ADR 0022 §5.
