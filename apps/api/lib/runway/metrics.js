/**
 * Runway retention metrics (ops/retention.md, ADR 0023).
 *
 * Pure computation over funnel events already filtered to source 'runway'
 * AND metadata.surface === 'web'. Events are [{ eventType, createdAt, metadata }].
 * UTC days are used throughout for cohort math.
 */

const DAY_MS = 86400000;

const toMs = (v) => (v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v));
const utcDay = (ms) => Math.floor(ms / DAY_MS);

function computeRunwayMetrics(events, { now = Date.now(), days = 14 } = {}) {
  const to = now;
  const from = to - days * DAY_MS;
  const evs = (events || [])
    .map((e) => ({ type: e.eventType, at: toMs(e.createdAt), md: e.metadata || {} }))
    .filter((e) => Number.isFinite(e.at))
    .sort((a, b) => a.at - b.at);

  const starts = evs.filter((e) => e.type === 'runway_start');
  const submits = evs.filter((e) => e.type === 'runway_submit');
  const verdicts = evs.filter((e) => e.type === 'runway_verdict');
  const shares = evs.filter((e) => e.type === 'runway_share');
  const fixEvents = evs.filter((e) => e.type === 'runway_fix').length;
  const eventsWithoutPlayerHash = evs.filter((e) => !e.md.playerHash).length;

  // Rounds matched by distinct roundId (same round id counted once per side).
  const startRoundIds = new Set(starts.map((e) => e.md.roundId).filter(Boolean));
  const submitRoundIds = new Set(submits.map((e) => e.md.roundId).filter(Boolean));
  const sampleSubmitRoundIds = new Set(
    submits.filter((e) => e.md.sample).map((e) => e.md.roundId).filter(Boolean));
  const sampleRounds = sampleSubmitRoundIds.size;
  const nonSampleStarts = new Set(
    starts.filter((e) => e.md.roundId && !sampleSubmitRoundIds.has(e.md.roundId)).map((e) => e.md.roundId));
  const nonSampleSubmits = new Set([...submitRoundIds].filter((r) => !sampleSubmitRoundIds.has(r)));
  const submissionRateExcludingSamples = nonSampleStarts.size
    ? nonSampleSubmits.size / nonSampleStarts.size : null;
  const submissionRate = startRoundIds.size ? submitRoundIds.size / startRoundIds.size : null;

  // Player-based metrics — only events carrying playerHash.
  const pStarts = starts.filter((e) => e.md.playerHash);
  const players = new Set(pStarts.map((e) => e.md.playerHash)).size;

  const startsPerPlayer = new Map();
  for (const e of pStarts) {
    const set = startsPerPlayer.get(e.md.playerHash) || new Set();
    set.add(e.md.roundId);
    startsPerPlayer.set(e.md.playerHash, set);
  }
  const repeatPlayers = [...startsPerPlayer.values()].filter((s) => s.size >= 2).length;
  const secondRoundRate = players ? repeatPlayers / players : null;

  const weekCut = utcDay(to) - 7;
  const weeklyActivePlayers = new Set(
    pStarts.filter((e) => utcDay(e.at) > weekCut && utcDay(e.at) <= utcDay(to)).map((e) => e.md.playerHash),
  ).size;

  // D1 / D7 return — first-seen within the fetched window (windowed cohort).
  const firstDay = new Map();
  const daysWithStart = new Map();
  for (const e of pStarts) {
    const d = utcDay(e.at);
    if (!firstDay.has(e.md.playerHash) || d < firstDay.get(e.md.playerHash)) firstDay.set(e.md.playerHash, d);
    const set = daysWithStart.get(e.md.playerHash) || new Set();
    set.add(d);
    daysWithStart.set(e.md.playerHash, set);
  }
  const today = utcDay(to);
  const cohortRate = (lagDays) => {
    let cohort = 0;
    let returned = 0;
    for (const [p, d0] of firstDay) {
      if (lagDays === 1 ? d0 > today - 1 : d0 > today - 7) continue;
      cohort++;
      const ds = daysWithStart.get(p);
      const hit = lagDays === 1 ? ds.has(d0 + 1) : [...ds].some((d) => d >= d0 + 1 && d <= d0 + 7);
      if (hit) returned++;
    }
    return { rate: cohort ? returned / cohort : null, cohort, returned };
  };

  const shareChannels = {};
  for (const e of shares) {
    const ch = e.md.channel || 'other';
    shareChannels[ch] = (shareChannels[ch] || 0) + 1;
  }

  // Share-to-player: starts tagged with a verified ref whose player is new.
  const seenBefore = new Set();
  let referredStarts = 0;
  for (const e of pStarts) {
    if (e.md.ref && !seenBefore.has(e.md.playerHash)) referredStarts++;
    seenBefore.add(e.md.playerHash);
  }

  return {
    window: { from: new Date(from).toISOString(), to: new Date(to).toISOString(), days },
    startedRounds: startRoundIds.size,
    submittedRounds: submitRoundIds.size,
    submissionRate,
    verdicts: verdicts.length,
    players,
    secondRoundRate,
    weeklyActivePlayers,
    d1Return: cohortRate(1),
    d7Return: cohortRate(7),
    cohortWindowCaveat: true,
    shares: shares.length,
    shareRate: verdicts.length ? shares.length / verdicts.length : null,
    shareChannels,
    shareToPlayer: {
      referredStarts,
      shares: shares.length,
      rate: shares.length ? referredStarts / shares.length : null,
    },
    fixEvents,
    sampleRounds,
    submissionRateExcludingSamples,
    eventsWithoutPlayerHash,
  };
}

module.exports = { computeRunwayMetrics };
