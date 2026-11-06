/**
 * Invite claims — single-use enforcement for /try/{token} invites.
 *
 * Web verifies the HMAC + expiry itself (stateless token); the only thing it
 * can't know statelessly is whether the link was already spent. That lives
 * here: SET hash NX EX — first claim wins, concurrent claims lose atomically,
 * and the key dies with the token's own 7-day TTL so nothing accumulates.
 *
 * Best-effort by design: when Redis is unreachable the caller still renders
 * (signature + expiry still bound the invite) — a spent-link edge during an
 * outage beats a broken gift for the recipient.
 */

const { getRedis } = require('./redis');

const KEY_PREFIX = 'invite:used:';
// Mirrors the web-side invite TTL (createInviteToken, 7 days).
const CLAIM_TTL_SEC = 7 * 24 * 3600;

/**
 * @returns {Promise<boolean|null>} true = claim won, false = already spent,
 *   null = store unreachable (caller proceeds unenforced)
 */
async function claimInvite(tokenHash) {
  const r = getRedis();
  if (!r) return null;
  try {
    const res = await r.set(KEY_PREFIX + tokenHash, '1', 'EX', CLAIM_TTL_SEC, 'NX');
    return res === 'OK';
  } catch {
    return null;
  }
}

/** Give the claim back — called when the render failed so a retry still works. */
async function releaseInvite(tokenHash) {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(KEY_PREFIX + tokenHash);
  } catch {
    /* best effort */
  }
}

module.exports = { claimInvite, releaseInvite };
