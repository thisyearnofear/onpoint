/**
 * Treasury Management — /api/agent/treasury
 *
 * Manages agent treasury, revenue streams, and compute expenses.
 *
 * Ported from apps/web/app/api/agent/treasury/route.ts
 *
 * GET  /api/agent/treasury — Check treasury balance and stats
 * POST /api/agent/treasury — Add revenue / record expense / pay compute / auto-fund
 *
 * Auth: serviceKeyAuth (applied at server.js mount level)
 */

const express = require('express');
const router = express.Router();
const { parseEther } = require('viem');
const treasuryService = require('../lib/treasury-service');
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

router.use(forwardedUser);

// ── GET /api/agent/treasury — Check treasury balance and stats ──

router.get('/', async (req, res) => {
  const userId = req.userContext.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const agentId = req.query.agentId || 'onpoint-stylist';
  const action = req.query.action;

  try {
    if (action === 'stats') {
      const stats = await treasuryService.getTreasuryStats(agentId);

      return res.json({
        ...stats,
        treasury: stats.treasury
          ? {
              ...stats.treasury,
              balanceFormatted: `${parseFloat((BigInt(stats.treasury.balance) / BigInt(1e18)).toString())} cUSD`,
              earnedFormatted: `${parseFloat((BigInt(stats.treasury.earned) / BigInt(1e18)).toString())} cUSD`,
              spentFormatted: `${parseFloat((BigInt(stats.treasury.spent) / BigInt(1e18)).toString())} cUSD`,
            }
          : null,
      });
    }

    const treasury = await treasuryService.getAgentTreasury(agentId);

    if (!treasury) {
      return res.status(404).json({
        exists: false,
        message: 'No treasury found. Revenue will initialize it automatically.',
      });
    }

    res.json({
      exists: true,
      treasury: {
        ...treasury,
        balanceFormatted: `${parseFloat((BigInt(treasury.balance) / BigInt(1e18)).toString())} cUSD`,
        earnedFormatted: `${parseFloat((BigInt(treasury.earned) / BigInt(1e18)).toString())} cUSD`,
        spentFormatted: `${parseFloat((BigInt(treasury.spent) / BigInt(1e18)).toString())} cUSD`,
      },
    });
  } catch (error) {
    logger.error('Treasury check error', { component: 'treasury' }, error);
    res.status(500).json({ error: 'Failed to check treasury' });
  }
});

// ── POST /api/agent/treasury — Manage treasury ──

router.post('/', async (req, res) => {
  const userId = req.userContext.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const body = req.body;
    const action = body.action;

    if (!action || !['add_revenue', 'record_expense', 'pay_compute', 'auto_fund'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action. Use: add_revenue, record_expense, pay_compute, or auto_fund',
      });
    }

    if (action === 'add_revenue') {
      const { agentId = 'onpoint-stylist', source, amount, from, txHash } = body;

      if (!source || !amount || !from) {
        return res.status(400).json({ error: 'source, amount, and from are required' });
      }

      if (!['tips', 'commissions', 'subscriptions', 'api_fees'].includes(source)) {
        return res.status(400).json({ error: 'Invalid source. Use: tips, commissions, subscriptions, or api_fees' });
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(from)) {
        return res.status(400).json({ error: 'Invalid from address (must be 0x...)' });
      }

      const amountWei = parseEther(amount);
      const result = await treasuryService.addRevenue(agentId, source, amountWei, from, txHash);

      return res.json({
        success: true,
        message: `Added ${amount} cUSD to treasury`,
        treasury: result.treasury,
        revenue: result.revenue,
      });
    }

    if (action === 'record_expense') {
      const { agentId = 'onpoint-stylist', type, amount, description } = body;

      if (!type || !amount || !description) {
        return res.status(400).json({ error: 'type, amount, and description are required' });
      }

      if (!['compute', 'api_call', 'gas', 'storage', 'other'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Use: compute, api_call, gas, storage, or other' });
      }

      const amountWei = parseEther(amount);
      const result = await treasuryService.recordExpense(agentId, type, amountWei, description);

      return res.json({
        success: true,
        message: `Recorded expense of ${amount} cUSD`,
        treasury: result.treasury,
        expense: result.expense,
      });
    }

    if (action === 'pay_compute') {
      const { agentId = 'onpoint-stylist', computeType, description } = body;

      if (!computeType || !description) {
        return res.status(400).json({ error: 'computeType and description are required' });
      }

      const validTypes = ['gemini_live', 'venice_vision', 'openai_gpt4', 'ipfs_pin', 'external_search'];
      if (!validTypes.includes(computeType)) {
        return res.status(400).json({ error: `Invalid computeType. Use: ${validTypes.join(', ')}` });
      }

      const result = await treasuryService.payForCompute(agentId, computeType, description);

      if (!result.success) {
        return res.status(402).json({ success: false, error: result.error });
      }

      return res.json({
        success: true,
        message: `Paid for ${computeType}`,
        treasury: result.treasury,
      });
    }

    if (action === 'auto_fund') {
      const agentId = body.agentId || 'onpoint-stylist';
      const result = await treasuryService.autoFundTreasury(agentId);

      return res.json({
        funded: result.funded,
        message: result.funded ? 'Treasury auto-funded' : 'Treasury balance sufficient',
        treasury: result.treasury,
      });
    }
  } catch (error) {
    logger.error('Treasury operation error', { component: 'treasury' }, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Operation failed',
    });
  }
});

module.exports = router;
