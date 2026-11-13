/**
 * Pending-intent mailbox routes — the seller-agent split.
 *
 *   GET /api/pending-intents?payee=store.onpoint.testnet
 *     → the seller agent's work queue: pending signed intents addressed
 *       to that payee (payloads are self-securing — whoever executes them,
 *       funds can only reach the intent's receiver_id).
 *   GET /api/pending-intents?solver=1
 *     → the OPEN solver queue: swap-funded intents broadcast to any solver
 *       (payee or not). The race is decided on-chain — first execute_intents
 *       to land wins; losers' nonces die and their complete() reports lose.
 *
 *   GET /api/pending-intents/:pendingId
 *     → the buyer's poll: pending | settled | failed | expired + result.
 *
 *   POST /api/pending-intents/:pendingId/complete  { txHash, status?, result?, executor? }
 *     → the executor reports the outcome. First completion wins — late
 *       reports get 409 ALREADY_COMPLETED, never an overwrite.
 *
 * Submission happens inside the order/try-on routes: POSTing
 * {signedIntent} instead of intentsTxHash returns 202 + pendingId.
 */

const express = require('express');
const mailbox = require('../lib/intent-mailbox');

const router = express.Router();

router.get('/', (req, res) => {
  const payee = String(req.query.payee || '');
  const solver = req.query.solver === '1' || req.query.solver === 'true';
  res.json({ pending: mailbox.list({ payee: payee || undefined, solver }) });
});

router.get('/:pendingId', (req, res) => {
  const p = mailbox.get(String(req.params.pendingId));
  if (!p) return res.status(404).json({ error: 'pending intent not found or expired' });
  res.json(p);
});

router.post('/:pendingId/complete', (req, res) => {
  const { txHash, status, result, executor } = req.body || {};
  const p = mailbox.complete(String(req.params.pendingId), {
    txHash: txHash ? String(txHash) : undefined,
    status: status === 'failed' ? 'failed' : 'settled',
    result,
    executor: executor ? String(executor) : undefined,
  });
  if (!p) return res.status(404).json({ error: 'pending intent not found or expired' });
  if (p.won === false) {
    if (p.attemptRecorded) return res.json({ ok: true, status: p.status, attemptRecorded: true });
    return res.status(409).json({ error: `already ${p.status} — the race was won by another executor`, code: 'ALREADY_COMPLETED', status: p.status, executor: p.executor ?? null });
  }
  res.json({ ok: true, status: p.status });
});

module.exports = router;
