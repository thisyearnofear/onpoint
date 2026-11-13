/**
 * Negotiation mailbox — the sovereign seller's work queue, mirroring
 * intent-mailbox.js.
 *
 * When a payee's seller process is alive (seller-presence), buyer offers do
 * NOT hit the hosted policy — they enqueue here, and the seller's own agent
 * polls them, decides with its own policy, and POSTs its response back. The
 * seller's "yes" and its signature are produced off-platform.
 *
 * Integrity split, stated plainly: counter/refuse responses are unsigned
 * relay text — non-binding by design (worst case is noise). The only
 * commitment is the quoteToken on `accept`, which the respond route
 * verifies by signature + the verifier's key registry before it lands on
 * the session. Pending items carry `round` so stale or duplicate seller
 * responses are ignored.
 *
 *   1. POST /api/curator/{slug}/negotiate → sovereign → enqueue → 202
 *   2. Seller polls GET /api/pending-negotiations?payee=…
 *   3. Seller POSTs /api/pending-negotiations/{id}/respond → applied to the
 *      session (round-checked, token verified on accept)
 *   4. Buyer polls GET /api/negotiations/{sessionId}
 *
 * Lifecycle: pending → answered | expired | superseded (a newer offer from
 * the same session replaces the unanswered one).
 */

const crypto = require('crypto');
const { persistedMap } = require('./kv-state');

const MAX_PENDING = 200;
const PENDING_TTL_MS = 60 * 1000; // seller polls ~3s; a dead seller expires fast
const pending = persistedMap('negotiation_mailbox', { expiresAtOf: (p) => p.expiresAt }); // pendingId → record

function sweep(now = Date.now()) {
  for (const [id, p] of pending) {
    if (p.status === 'pending' && p.expiresAt <= now) p.status = 'expired';
    if (pending.size > MAX_PENDING && p.status !== 'pending') pending.delete(id);
  }
}

/**
 * Enqueue a buyer offer for a sovereign seller. Any earlier unanswered item
 * for the same session is superseded — the seller only ever owes the latest
 * round an answer.
 *   offer: {kind:'offer', cents} | {kind:'accept'}  (buyer counters, or
 *           takes the seller's ask — the signature still belongs to the seller)
 *   context: the session facts the seller's own policy needs (scope,
 *           curatorSlug, listingId, size, quantity, listCents, bundle,
 *           askCents, history)
 */
function enqueue({ sessionId, payee, round, offer, context }, now = Date.now()) {
  sweep(now);
  for (const [id, p] of pending.entries()) {
    if (p.sessionId === sessionId && p.status === 'pending') {
      p.status = 'superseded';
      pending.set(id, p); // flush the mutation
    }
  }
  const pendingId = `pnx_${crypto.randomBytes(9).toString('hex')}`;
  const rec = {
    pendingId,
    sessionId,
    payee,
    round,
    offer, // {kind, cents?}
    context, // session facts — informational inputs, the seller's policy owns the decision
    status: 'pending',
    response: null,
    createdAt: now,
    expiresAt: now + PENDING_TTL_MS,
  };
  pending.set(pendingId, rec);
  return rec;
}

function list({ payee } = {}, now = Date.now()) {
  sweep(now);
  return [...pending.values()]
    .filter((p) => p.status === 'pending' && (!payee || p.payee === payee))
    .sort((a, b) => a.createdAt - b.createdAt);
}

function get(pendingId, now = Date.now()) {
  sweep(now);
  return pending.get(pendingId) ?? null;
}

/** Mark the item answered with the seller's response (route applies it). */
function answer(pendingId, response) {
  const p = pending.get(pendingId);
  if (!p) return null;
  p.status = 'answered';
  p.response = response;
  p.answeredAt = new Date().toISOString();
  pending.set(pendingId, p); // flush the mutation
  return p;
}

/** Expire / clear the pending pointer (e.g. session fell back to hosted). */
function cancel(pendingId, status = 'expired') {
  const p = pending.get(pendingId);
  if (!p) return null;
  if (p.status === 'pending') {
    p.status = status;
    pending.set(pendingId, p); // flush the mutation
  }
  return p;
}

module.exports = { enqueue, list, get, answer, cancel, PENDING_TTL_MS, _pending: pending };
