/**
 * Escrow Management — /api/agent/escrow
 *
 * Manages user escrow accounts for agent spending.
 * Users deposit funds that agents can spend within approved allowances.
 *
 * Ported from apps/web/app/api/agent/escrow/route.ts
 *
 * GET  /api/agent/escrow — Check escrow balance
 * POST /api/agent/escrow — Deposit / update allowance / withdraw
 *
 * Auth: serviceKeyAuth (applied at server.js mount level)
 */

const express = require('express');
const router = express.Router();
const { parseEther } = require('viem');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

router.use(forwardedUser);

// ── GET /api/agent/escrow — Check escrow balance ──

router.get('/', async (req, res) => {
  const userId = req.userContext.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const agentId = req.query.agentId || 'onpoint-stylist';

  try {
    const balance = await agentCore.getEscrowBalance(userId, agentId);

    if (!balance) {
      return res.status(404).json({
        exists: false,
        message: 'No escrow account found. Initialize by depositing funds.',
      });
    }

    const fmt = (val) => parseFloat((BigInt(val) / BigInt(1e18)).toString());

    res.json({
      exists: true,
      balance: {
        ...balance,
        balanceFormatted: `${fmt(balance.balance)} cUSD`,
        allowanceFormatted: `${fmt(balance.allowance)} cUSD`,
        spentFormatted: `${fmt(balance.spent)} cUSD`,
        remainingFormatted: `${fmt(BigInt(balance.allowance) - BigInt(balance.spent))} cUSD`,
      },
    });
  } catch (error) {
    logger.error('Escrow balance check error', { component: 'escrow' }, error);
    res.status(500).json({ error: 'Failed to check escrow balance' });
  }
});

// ── POST /api/agent/escrow — Deposit / update allowance / withdraw ──

router.post('/', async (req, res) => {
  const userId = req.userContext.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const body = req.body;
    const action = body.action;

    if (!action || !['deposit', 'updateAllowance', 'withdraw'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action. Use: deposit, updateAllowance, or withdraw',
      });
    }

    if (action === 'deposit') {
      const { amount, txHash, chainId = 42220, agentId = 'onpoint-stylist' } = body;

      if (!amount || !txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return res.status(400).json({ error: 'amount and valid txHash (0x...) required' });
      }

      const amountWei = parseEther(amount);
      const result = await agentCore.depositToEscrow(userId, agentId, amountWei, txHash, chainId);

      return res.json({
        success: true,
        message: `Deposited ${amount} cUSD to escrow`,
        balance: result,
      });
    }

    if (action === 'updateAllowance') {
      const { allowance, agentId = 'onpoint-stylist' } = body;

      if (!allowance) {
        return res.status(400).json({ error: 'allowance required' });
      }

      const allowanceWei = parseEther(allowance);
      const result = await agentCore.updateAllowance(userId, agentId, allowanceWei);

      return res.json({
        success: true,
        message: `Updated allowance to ${allowance} cUSD`,
        balance: result,
      });
    }

    if (action === 'withdraw') {
      const { amount, recipient, agentId = 'onpoint-stylist' } = body;

      if (!amount || !recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
        return res.status(400).json({ error: 'amount and valid recipient address (0x...) required' });
      }

      const amountWei = parseEther(amount);
      const result = await agentCore.withdrawFromEscrow(userId, agentId, amountWei, recipient);

      return res.json({
        success: true,
        message: `Withdrawal initiated for ${amount} cUSD`,
        withdrawal: result.withdrawal,
        balance: result.balance,
      });
    }
  } catch (error) {
    logger.error('Escrow operation error', { component: 'escrow' }, error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Operation failed',
    });
  }
});

module.exports = router;
