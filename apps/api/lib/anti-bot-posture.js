/**
 * Anti-bot posture helper — single source of truth (ADR 0008 D4).
 *
 * Decides per-query which `browser_profile` and `proxy_country` TinyFish
 * should use. Imported by both `apps/api/routes/agent-tasks.js`
 * (the `/execute` SSE handler) and `apps/api/worker.js`
 * (the market-signal poller), so the rule lives in exactly one place
 * and cannot drift between the two callers.
 *
 * Per DRY: do not duplicate this rule. If you need a different posture
 * for a new merchant class, extend `PROTECTED_DOMAINS` below.
 */

const PROTECTED_DOMAINS = new Set([
  'farfetch.com',
  'ssense.com',
  'nordstrom.com',
  'net-a-porter.com',
]);

/**
 * @param {string} query - the search query the agent will run
 * @returns {{ browserProfile: 'LITE'|'STEALTH', proxyCountry: string|null }}
 */
function antiBotPostureForQuery(query) {
  const q = (query || '').toLowerCase();
  for (const domain of PROTECTED_DOMAINS) {
    if (q.includes(domain)) {
      return { browserProfile: 'STEALTH', proxyCountry: 'US' };
    }
  }
  return { browserProfile: 'LITE', proxyCountry: null };
}

module.exports = { antiBotPostureForQuery, PROTECTED_DOMAINS };
