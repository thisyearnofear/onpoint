/**
 * Pending-intent mailbox routes — the seller-agent split.
 *
 *   GET /api/pending-intents?payee=store.onpoint.testnet
 *     → the seller agent's work queue: pending signed intents addressed
 *       to that payee (payloads are self-securing — whoever executes them,
 *       funds can only reach the intent's receiver_id).
 *
 *   GET /api/pending-intents/:pendingId
 *     → the buyer's poll: pending | settled | failed | expired + result.
 *
 *   POST /api/pending-intents/:pendingId/complete  { txHash, status?, result? }
 *     → the seller reports the outcome after executing + redeeming.
 *
 * Submission happens inside the order/try-on routes: POSTing
 * {signedIntent} instead of intentsTxHash returns 202 + pendingId.
 */

const express = require('express');
const mailbox = require('../lib/intent-mailbox');

const router = express.Router();

router.get('/', (req, res) => {
  const payee = String(req.query.payee || '');
  res.json({ pending: mailbox.list({ payee: payee || undefined }) });
});

router.get('/:pendingId', (req, res) => {
  const p = mailbox.get(String(req.params.pendingId));
  if (!p) return res.status(404).json({ error: 'pending intent not found or expired' });
  res.json(p);
});

router.post('/:pendingId/complete', (req, res) => {
  const { txHash, status, result } = req.body || {};
  const p = mailbox.complete(String(req.params.pendingId), {
    txHash: txHash ? String(txHash) : undefined,
    status: status === 'failed' ? 'failed' : 'settled',
    result,
  });
  if (!p) return res.status(404).json({ error: 'pending intent not found or expired' });
  res.json({ ok: true, status: p.status });
});

module.exports = router;
