/**
 * Agent Tipping Route — /api/agent/tip
 *
 * Allows users to tip the AI Stylist agent.
 * Records tips in persistent state ledger.
 * Returns agent wallet address for the specified chain.
 *
 * Ported from apps/web/app/api/agent/tip/route.ts
 *
 * Auth: SERVICE_API_KEY + forwarded user context (POST requires auth)
 */

const express = require('express');
const router = express.Router();
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { forwardedUser, requireUserField } = require('../middleware/forwarded-user');

const TIP_LEDGER_KEY = 'agent:tip-ledger:v1';

async function getTipLedger() {
  return agentCore.readPersistentState(TIP_LEDGER_KEY, () => []);
}

async function saveTipLedger(entries) {
  await agentCore.writePersistentState(TIP_LEDGER_KEY, entries);
}

async function resolveAgentAddress(chain) {
  try {
    const wallet = await agentCore.getAgentWallet();
    const addresses = await wallet.getAddresses();
    return (
      addresses[chain] ??
      addresses.celo ??
      addresses.base ??
      Object.values(addresses)[0] ??
      ''
    );
  } catch (err) {
    logger.error('Failed to resolve agent address', { component: 'agent-tip', chain }, err);
    return '';
  }
}

router.use(forwardedUser);

// POST /api/agent/tip — Record a tip
router.post('/', async (req, res) => {
  const { fromAddress, amount, chain, token, message } = req.body;

  // Validate
  if (!fromAddress || !amount || !chain) {
    return res.status(400).json({
      error: 'Missing required fields: fromAddress, amount, chain',
    });
  }

  if (!fromAddress.startsWith('0x') || fromAddress.length !== 42) {
    return res.status(400).json({ error: 'Invalid fromAddress format' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    const agentAddress = await resolveAgentAddress(chain);
    if (!agentAddress) {
      return res.status(503).json({ error: 'Agent wallet not available' });
    }

    const tipId = `tip_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const tipToken = token || (chain === 'celo' ? 'cUSD' : 'USDT');

    const tip = {
      id: tipId,
      from: fromAddress,
      to: agentAddress,
      amount,
      chain,
      token: tipToken,
      timestamp: Date.now(),
      message,
      status: 'pending',
    };

    const tipLedger = await getTipLedger();
    tipLedger.push(tip);
    await saveTipLedger(tipLedger);

    logger.info('Recorded agent tip', {
      component: 'agent-tip',
      amount,
      token: tipToken,
      chain,
    });

    res.json({
      success: true,
      tip: {
        id: tipId,
        amount,
        token: tipToken,
        chain,
        toAddress: agentAddress,
        status: 'pending',
        timestamp: tip.timestamp,
      },
      agentResponse: message
        ? `Thank you for the ${amount} ${tipToken} tip! Your message: "${message}"`
        : `Thank you for the ${amount} ${tipToken} tip!`,
    });
  } catch (error) {
    logger.error('Tip processing failed', { component: 'agent-tip' }, error);
    res.status(500).json({ error: 'Failed to process tip' });
  }
});

// GET /api/agent/tip — Get tip stats and recent tips
router.get('/', async (req, res) => {
  try {
    const tipLedger = await getTipLedger();
    const wallet = await agentCore.getAgentWallet().catch(() => null);
    const addresses = wallet ? await wallet.getAddresses() : {};

    const totalTips = tipLedger.reduce((sum, tip) => sum + parseFloat(tip.amount), 0);

    res.json({
      agent: {
        name: 'OnPoint AI Stylist',
        addresses,
        supportedChains: Object.keys(addresses),
      },
      totalTips: totalTips.toString(),
      tipCount: tipLedger.length,
      recentTips: tipLedger.slice(-10).reverse(),
    });
  } catch (error) {
    logger.error('Failed to load tip stats', { component: 'agent-tip' }, error);
    res.status(500).json({ error: 'Failed to get tip info' });
  }
});

module.exports = router;
