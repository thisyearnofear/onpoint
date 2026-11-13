/**
 * Sovereign-negotiation mailbox + presence routes.
 *
 *   GET  /api/pending-negotiations?payee=<id>
 *     → the seller agent's work queue: offers awaiting ITS decision.
 *       Responses are unsigned and non-binding — only an `accept` carrying
 *       a verified quoteToken commits anything.
 *
 *   POST /api/pending-negotiations/:pendingId/respond
 *     { round, decision:"counter"|"refuse"|"accept", price?, reasoning?, quoteToken? }
 *     → the seller answers. `round` must match the pending item — stale or
 *       duplicate answers are ignored. On accept the API verifies the
 *       quoteToken's signature AND that its signer is authorized for the
 *       session's payee (hosted key match, else has_public_key in the
 *       verifier registry) before the session moves to `accepted`.
 *
 *   GET  /api/negotiations/:sessionId
 *     → the buyer's poll: full session state. If the pending offer expired
 *       and the seller went quiet, resolves the pending round through the
 *       hosted policy when the platform holds a key for the payee —
 *       sellerMode visibly flips sovereign→hosted. Payees with no hosted
 *       key have no fallback: the offer waits for a process that can sign.
 *
 *   POST /api/seller-presence { payee }
 *     → the heartbeat. Unsigned BY DESIGN — liveness, not auth. Freshness
 *       (<45s) selects sovereign vs hosted; it can never produce a binding
 *       artifact on its own.
 */

const express = require('express');
const mailbox = require('../lib/negotiation-mailbox');
const presence = require('../lib/seller-presence');
const neg = require('../lib/agent-negotiation');

const router = express.Router();

function sessionSnapshotForBuyer(session) {
  const base = neg.sessionSnapshot(session);
  if (session.status === 'countered') {
    base.counterOffer = { offerUsd: session.askCents / 100, currency: 'USD' };
    base.reasoning = session.reasoning;
  }
  if (session.status === 'accepted' && session.quoteToken) {
    base.agreedUsd = session.agreedCents / 100;
    base.quoteToken = session.quoteToken;
  }
  return base;
}

// If a sovereign session's pending offer expired while the seller is dead,
// resolve the waiting round through the hosted policy (only possible when
// the platform holds a key for the payee — sovereign-only payees wait).
async function resolvePendingSession(session) {
  if (!session || session.status !== 'pending_seller' || !session.pendingId) return session;
  const item = mailbox.get(session.pendingId);
  if (item && item.status === 'pending') return session; // still live
  if (item) mailbox.cancel(item.pendingId, item.status === 'pending' ? 'expired' : item.status);
  session.pendingId = null;
  if (presence.isFresh(session.payee)) return session; // still pending — item raced
  if (!neg.hasHostedKey(session.payee)) {
    // No hosted key exists for this payee: the platform cannot sign as it.
    // The offer stays with the seller's process — custody made mechanical.
    return session;
  }
  session.sellerMode = 'hosted';
  const offerCents = item?.offer?.kind === 'offer' ? item.offer.cents : session.askCents;
  // The pending offer already sits in history (pushed at enqueue) — evaluate
  // it like a fresh hosted round (eval BEFORE recording, as runRound does),
  // not as a stagnant repeat. The seller's silence isn't the buyer's fault.
  const lastBuyer = (() => {
    for (let i = session.history.length - 1; i >= 0; i--) {
      if (session.history[i].actor === 'buyer') return i;
    }
    return -1;
  })();
  const evalSession = lastBuyer >= 0
    ? { ...session, history: session.history.filter((_, i) => i !== lastBuyer) }
    : session;
  const decision = neg.evaluateSellerPolicy(evalSession, offerCents);
  const llmText = await neg.veniceReasoning({ session, decision, priceCents: decision.priceCents, offerCents });
  neg.applySellerDecision(session, {
    decision: decision.decision,
    priceCents: decision.priceCents,
    why: `${decision.why} (hosted fallback — seller presence lost)`,
    reasoning: llmText || decision.reasoning,
  });
  if (session.status === 'accepted' && !session.quoteToken) {
    session.quoteToken = neg.mintQuoteToken({
      scope: session.scope, curatorSlug: session.curatorSlug, listingId: session.listingId,
      size: session.size, quantity: session.quantity,
      agreedCusd: session.agreedCents / 100, sessionId: session.sessionId, payee: session.payee,
    });
  }
  neg.saveSession(session); // applySellerDecision flushed earlier; the token lands after it
  return session;
}

// ── the seller's work queue ──────────────────────────────────────────────
router.get('/pending-negotiations', (req, res) => {
  const payee = String(req.query.payee || '');
  res.json({ pending: mailbox.list({ payee: payee || undefined }) });
});

// ── the seller answers ───────────────────────────────────────────────────
router.post('/pending-negotiations/:pendingId/respond', async (req, res) => {
  const item = mailbox.get(String(req.params.pendingId));
  if (!item) return res.status(404).json({ error: 'pending negotiation not found or expired' });
  if (item.status !== 'pending') {
    return res.status(409).json({ error: `already ${item.status}`, code: 'NOT_PENDING' });
  }
  const { round, decision, price, reasoning, quoteToken } = req.body || {};
  if (Number(round) !== item.round) {
    return res.status(409).json({ error: `stale round — session is on round ${item.round}`, code: 'STALE_ROUND', round: item.round });
  }
  const session = neg.getSession(item.sessionId);
  if (!session || session.status !== 'pending_seller' || session.pendingId !== item.pendingId) {
    mailbox.cancel(item.pendingId);
    return res.status(409).json({ error: 'session is no longer awaiting a seller response', code: 'SESSION_NOT_PENDING' });
  }

  const text = typeof reasoning === 'string' && reasoning.trim() ? reasoning.trim().slice(0, 500) : null;
  const apply = (d) => {
    neg.applySellerDecision(session, { ...d, reasoning: text || d.reasoning });
    mailbox.answer(item.pendingId, { decision, price, reasoning: text });
    return res.json(sessionSnapshotForBuyer(session));
  };

  if (decision === 'counter') {
    const priceCents = Math.round(Number(price) * 100);
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      return res.status(400).json({ error: 'counter requires a positive price (USD)' });
    }
    const ask = Math.min(priceCents, session.listCents); // a seller never asks above list
    return apply({ decision: 'counter', priceCents: ask, why: 'seller_counter', reasoning: text || `Countering at ${(ask / 100).toFixed(2)}.` });
  }
  if (decision === 'refuse') {
    return apply({ decision: 'reject', priceCents: null, why: 'seller_refused', reasoning: text || 'No deal.' });
  }
  if (decision === 'accept') {
    if (!quoteToken || typeof quoteToken !== 'object') {
      return res.status(400).json({ error: 'accept requires quoteToken — the signed commitment' });
    }
    const check = neg.verifyQuoteToken(quoteToken);
    if (!check.ok) {
      return res.status(409).json({ error: check.error, code: 'QUOTE_TOKEN_INVALID' });
    }
    const p = check.payload || {};
    if (
      p.sessionId !== session.sessionId || p.payee !== session.payee
      || p.scope !== session.scope || p.curatorSlug !== session.curatorSlug
      || p.listingId !== session.listingId || (p.size ?? null) !== session.size
      || (p.quantity ?? null) !== session.quantity
      || check.signerAccountId !== session.payee
    ) {
      return res.status(409).json({
        error: 'quoteToken does not bind this session (sessionId/payee/scope/listing/size/quantity/signer)',
        code: 'QUOTE_TOKEN_MISMATCH',
      });
    }
    const agreedCents = Math.round(Number(p.agreedCusd) * 100);
    if (!Number.isFinite(agreedCents) || agreedCents <= 0 || agreedCents > session.listCents) {
      return res.status(409).json({ error: 'quoteToken price is out of range for this listing', code: 'QUOTE_TOKEN_MISMATCH' });
    }
    // The commitment's authorization: hosted-key match, or the payee's own
    // key in the verifier registry. This is the sovereignty check.
    const auth = await neg.authorizeQuoteSigner({ signerAccountId: check.signerAccountId, publicKey: check.signerPublicKey });
    if (!auth.ok) {
      return res.status(409).json({ error: `quoteToken signer not authorized for ${session.payee}: ${auth.reason}`, code: 'SIGNER_UNAUTHORIZED' });
    }
    session.quoteToken = quoteToken;
    return apply({ decision: 'accept', priceCents: agreedCents, why: `seller_accepted (${auth.via}-signed)`, reasoning: text || `Deal at ${(agreedCents / 100).toFixed(2)}.` });
  }
  return res.status(400).json({ error: 'decision must be counter | refuse | accept' });
});

// ── the buyer's poll ─────────────────────────────────────────────────────
router.get('/negotiations/:sessionId', async (req, res) => {
  const session = neg.getSession(String(req.params.sessionId));
  if (!session) return res.status(404).json({ error: 'Negotiation session not found or expired' });
  await resolvePendingSession(session).catch(() => session);
  return res.json(sessionSnapshotForBuyer(session));
});

// ── seller presence heartbeat (unsigned liveness — see lib/seller-presence) ──
router.post('/seller-presence', (req, res) => {
  const payee = String(req.body?.payee || '');
  if (!/^[a-z0-9._-]+\.(testnet|near)$/.test(payee)) {
    return res.status(400).json({ error: 'payee must be a NEAR account id' });
  }
  const rec = presence.beat(payee);
  res.json({ ok: true, payee, lastSeenAt: rec.lastSeenIso, fresh: presence.isFresh(payee) });
});

module.exports = router;
module.exports.resolvePendingSession = resolvePendingSession;
module.exports.sessionSnapshotForBuyer = sessionSnapshotForBuyer;
