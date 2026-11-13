/**
 * Seller presence — liveness heartbeat for sovereign payees.
 *
 * `POST /api/seller-presence {payee}` stamps "a seller process for this
 * payee is alive". Freshness (<45s) selects the negotiation path: fresh →
 * sovereign (offers go to the seller's own process through the negotiation
 * mailbox); stale → hosted (platform policy + hosted key, when one exists).
 *
 * Unsigned BY DESIGN: presence is liveness, not auth. The worst a forged
 * heartbeat does is route an offer to a mailbox that must still produce a
 * valid signature for its payee — no binding artifact is ever granted on
 * presence alone. Rate-limited like every public route.
 *
 * In-memory like the negotiation sessions — swap to Postgres with dev 2's
 * persistence work (same TTL discipline).
 */

const FRESH_MS = 45 * 1000;
const MAX_ENTRIES = 500;
const seen = new Map(); // payee → lastSeen ms

function sweep(now = Date.now()) {
  for (const [payee, rec] of seen) {
    if (now - rec.lastSeenAt > 10 * 60 * 1000 || seen.size > MAX_ENTRIES) seen.delete(payee);
  }
}

/** Record a heartbeat. Returns the stamped record. */
function beat(payee, now = Date.now()) {
  sweep(now);
  const rec = { payee, lastSeenAt: now, lastSeenIso: new Date(now).toISOString() };
  seen.set(payee, rec);
  return rec;
}

/** Fresh = a seller process beat within the last 45s. */
function isFresh(payee, now = Date.now()) {
  const rec = seen.get(payee);
  return !!rec && now - rec.lastSeenAt < FRESH_MS;
}

function lastSeen(payee) {
  return seen.get(payee) ?? null;
}

module.exports = { beat, isFresh, lastSeen, FRESH_MS, _seen: seen };
