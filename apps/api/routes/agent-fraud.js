/**
 * Agent Fraud Detection Route — /api/agent/fraud
 *
 * Monitors agent health, manages freezing, and handles multi-sig approvals.
 *
 * Ported from apps/web/app/api/agent/fraud/route.ts
 *
 * Auth: SERVICE_API_KEY + forwarded user context
 */

const express = require('express');
const router = express.Router();
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

router.use(forwardedUser);

// GET /api/agent/fraud?action=health|multisig&agentId=...&txId=...
router.get('/', async (req, res) => {
  const agentId = req.query.agentId || 'onpoint-stylist';
  const userId = req.userContext.userId || 'system';
  const action = req.query.action;

  try {
    if (action === 'health') {
      const health = await agentCore.checkAgentHealth(agentId, userId).catch(() => ({
        status: 'unknown',
        lastHeartbeat: null,
        heartbeatsMissed: 0,
      }));
      const frozen = await agentCore.isAgentFrozen(agentId, userId).catch(() => false);

      return res.json({ health, frozen });
    }

    if (action === 'multisig') {
      const txId = req.query.txId;
      if (!txId) {
        return res.status(400).json({ error: 'Transaction ID required' });
      }

      const requirement = await agentCore.getMultiSigRequirement(txId).catch(() => null);
      if (!requirement) {
        return res.status(404).json({ error: 'Multi-sig requirement not found' });
      }

      return res.json({ requirement });
    }

    return res.status(400).json({ error: 'Invalid action. Use: health or multisig' });
  } catch (error) {
    logger.error('Fraud check error', { component: 'fraud' }, error);
    res.status(500).json({ error: 'Failed to check fraud status' });
  }
});

// POST /api/agent/fraud — freeze, unfreeze, sign_multisig
router.post('/', async (req, res) => {
  const userId = req.userContext.userId || 'system';
  const { action, agentId, reason, transactionId, signature } = req.body;

  try {
    if (action === 'freeze') {
      if (!agentId || !reason) {
        return res.status(400).json({ error: 'agentId and reason required' });
      }

      await agentCore.freezeAgent(agentId, userId, reason);
      return res.json({ success: true, message: `Agent ${agentId} frozen`, reason });
    }

    if (action === 'unfreeze') {
      if (!agentId) {
        return res.status(400).json({ error: 'agentId required' });
      }

      await agentCore.unfreezeAgent(agentId, userId);
      return res.json({ success: true, message: `Agent ${agentId} unfrozen` });
    }

    if (action === 'sign_multisig') {
      if (!transactionId || !signature) {
        return res.status(400).json({ error: 'transactionId and signature required' });
      }

      const requirement = await agentCore.addMultiSigSignature(
        transactionId,
        userId,
        signature,
      );

      if (!requirement) {
        return res.status(404).json({ error: 'Multi-sig requirement not found' });
      }

      return res.json({
        success: true,
        requirement,
        approved: requirement.status === 'approved',
      });
    }

    return res.status(400).json({ error: 'Invalid action. Use: freeze, unfreeze, or sign_multisig' });
  } catch (error) {
    logger.error('Fraud control error', { component: 'fraud' }, error);
    res.status(500).json({ error: error.message || 'Operation failed' });
  }
});

module.exports = router;
