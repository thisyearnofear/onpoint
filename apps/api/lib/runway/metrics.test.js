import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { computeRunwayMetrics } = require('./metrics');

// Fixed "now": 2026-11-10T12:00:00Z (UTC day 20786)
const NOW = Date.parse('2026-11-10T12:00:00Z');
const day = (iso) => Date.parse(`${iso}T09:00:00Z`);

const ev = (eventType, at, metadata = {}) => ({ eventType, createdAt: at, metadata });

describe('computeRunwayMetrics', () => {
  it('counts rounds by distinct roundId and matches submissions', () => {
    const events = [
      ev('runway_start', day('2026-11-09'), { roundId: 'r1', playerHash: 'p1' }),
      ev('runway_start', day('2026-11-09'), { roundId: 'r1', playerHash: 'p1' }), // dup round id
      ev('runway_start', day('2026-11-09'), { roundId: 'r2', playerHash: 'p2' }),
      ev('runway_submit', day('2026-11-09'), { roundId: 'r1', playerHash: 'p1' }),
      ev('runway_verdict', day('2026-11-09'), { roundId: 'r1', playerHash: 'p1' }),
    ];
    const m = computeRunwayMetrics(events, { now: NOW, days: 14 });
    expect(m.startedRounds).toBe(2);
    expect(m.submittedRounds).toBe(1);
    expect(m.submissionRate).toBeCloseTo(0.5);
    expect(m.verdicts).toBe(1);
    expect(m.players).toBe(2);
    expect(m.cohortWindowCaveat).toBe(true);
  });

  it('returns null rates on empty input', () => {
    const m = computeRunwayMetrics([], { now: NOW, days: 14 });
    expect(m.startedRounds).toBe(0);
    expect(m.submissionRate).toBeNull();
    expect(m.secondRoundRate).toBeNull();
    expect(m.shareRate).toBeNull();
    expect(m.d1Return).toEqual({ rate: null, cohort: 0, returned: 0 });
    expect(m.shareToPlayer).toEqual({ referredStarts: 0, shares: 0, rate: null });
    expect(m.eventsWithoutPlayerHash).toBe(0);
  });

  it('computes second-round rate over distinct round ids per player', () => {
    const events = [
      ev('runway_start', day('2026-11-08'), { roundId: 'a', playerHash: 'p1' }),
      ev('runway_start', day('2026-11-09'), { roundId: 'b', playerHash: 'p1' }), // p1 second round
      ev('runway_start', day('2026-11-09'), { roundId: 'b', playerHash: 'p1' }), // dup, still 2
      ev('runway_start', day('2026-11-09'), { roundId: 'c', playerHash: 'p2' }),
    ];
    const m = computeRunwayMetrics(events, { now: NOW, days: 14 });
    expect(m.players).toBe(2);
    expect(m.secondRoundRate).toBeCloseTo(0.5);
  });

  it('computes D1 and D7 return from first-seen cohort day', () => {
    // p1 first seen D=11-01, returns D+1 (11-02): d1 yes; also inside D+1..D+7: d7 yes
    // p2 first seen D=11-02, next start 11-09: d1 no (nothing on 11-03), d7 yes (inside +1..+7)
    // p3 first seen today — excluded from both cohorts
    const events = [
      ev('runway_start', day('2026-11-01'), { roundId: 'a', playerHash: 'p1' }),
      ev('runway_start', day('2026-11-02'), { roundId: 'b', playerHash: 'p1' }),
      ev('runway_start', day('2026-11-02'), { roundId: 'c', playerHash: 'p2' }),
      ev('runway_start', day('2026-11-09'), { roundId: 'd', playerHash: 'p2' }),
      ev('runway_start', day('2026-11-10'), { roundId: 'e', playerHash: 'p3' }),
    ];
    const m = computeRunwayMetrics(events, { now: NOW, days: 30 });
    expect(m.d1Return).toEqual({ rate: 0.5, cohort: 2, returned: 1 });
    expect(m.d7Return).toEqual({ rate: 1, cohort: 2, returned: 2 });
  });

  it('weeklyActivePlayers counts starts in the trailing 7 days', () => {
    const events = [
      ev('runway_start', day('2026-11-02'), { roundId: 'a', playerHash: 'old' }), // 8 days back — outside
      ev('runway_start', day('2026-11-04'), { roundId: 'b', playerHash: 'p1' }),
      ev('runway_start', day('2026-11-09'), { roundId: 'c', playerHash: 'p2' }),
    ];
    const m = computeRunwayMetrics(events, { now: NOW, days: 30 });
    expect(m.weeklyActivePlayers).toBe(2);
    expect(m.players).toBe(3);
  });

  it('shares: channel counts, rate vs verdicts, shareToPlayer with new players only', () => {
    const events = [
      ev('runway_start', day('2026-11-08'), { roundId: 'a', playerHash: 'p1' }),
      ev('runway_verdict', day('2026-11-08'), { roundId: 'a', playerHash: 'p1' }),
      ev('runway_verdict', day('2026-11-08'), { roundId: 'a', playerHash: 'p1' }),
      ev('runway_share', day('2026-11-08'), { roundId: 'a', channel: 'instagram', playerHash: 'p1' }),
      ev('runway_share', day('2026-11-08'), { roundId: 'a', channel: 'x', playerHash: 'p1' }),
      // new player arrives via ref → referredStart; repeats not counted
      ev('runway_start', day('2026-11-09'), { roundId: 'b', playerHash: 'p2', ref: 'a' }),
      ev('runway_start', day('2026-11-09'), { roundId: 'c', playerHash: 'p2', ref: 'a' }),
      // start with ref but no playerHash — excluded from referredStarts
      ev('runway_start', day('2026-11-09'), { roundId: 'd', ref: 'a' }),
      ev('runway_fix', day('2026-11-09'), { roundId: 'b' }),
    ];
    const m = computeRunwayMetrics(events, { now: NOW, days: 14 });
    expect(m.shares).toBe(2);
    expect(m.shareRate).toBe(1); // 2 shares / 2 verdicts
    expect(m.shareChannels).toEqual({ instagram: 1, x: 1 });
    expect(m.shareToPlayer).toEqual({ referredStarts: 1, shares: 2, rate: 0.5 });
    expect(m.fixEvents).toBe(1);
    expect(m.eventsWithoutPlayerHash).toBe(2);
  });

  it('accepts ISO strings and ms timestamps interchangeably', () => {
    const events = [
      ev('runway_start', '2026-11-09T09:00:00Z', { roundId: 'a', playerHash: 'p1' }),
      ev('runway_start', day('2026-11-09'), { roundId: 'b', playerHash: 'p1' }),
    ];
    const m = computeRunwayMetrics(events, { now: NOW, days: 14 });
    expect(m.startedRounds).toBe(2);
    expect(m.secondRoundRate).toBe(1);
  });

  it('ignores malformed createdAt rows', () => {
    const events = [
      { eventType: 'runway_start', createdAt: 'not-a-date', metadata: { roundId: 'x', playerHash: 'p' } },
      ev('runway_start', day('2026-11-09'), { roundId: 'a', playerHash: 'p' }),
    ];
    const m = computeRunwayMetrics(events, { now: NOW, days: 14 });
    expect(m.startedRounds).toBe(1);
  });
});
