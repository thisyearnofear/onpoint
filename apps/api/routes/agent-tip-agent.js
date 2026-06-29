/**
 * Agent-to-Agent Tipping — /api/agent/tip-agent
 *
 * Allows one AI agent to tip another agent.
 * Demonstrates autonomous agent-to-agent economic interactions.
 *
 * Ported from apps/web/app/api/agent/tip-agent/route.ts
 *
 * GET  /api/agent/tip-agent — List tip ledger + stats
 * POST /api/agent/tip-agent — Create a tip (fromAgent → toAgent)
 *
 * Auth: serviceKeyAuth (applied at server.js mount level)
 */

const express = require('express');
const router = express.Router();
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

const { countAction } = agentCore.Metrics ?? {};

const AGENT_TIP_LEDGER_KEY = 'agent:tip-ledger:a2a:v1';

router.use(forwardedUser);

// ── Helpers ──

async function getAgentTipLedger() {
  return agentCore.readPersistentState(AGENT_TIP_LEDGER_KEY, () => []);
}

async function saveAgentTipLedger(entries) {
  await agentCore.writePersistentState(AGENT_TIP_LEDGER_KEY, entries);
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
    logger.warn('Failed to resolve agent address', { component: 'tip-agent', chain }, err);
    return '';
  }
}

// ── POST /api/agent/tip-agent — Create a tip ──

router.post('/', async (req, res) => {
  const userId = req.userContext.userId || 'agent';

  try {
    const { fromAgentId, toAgentId, amount, chain, token, message } = req.body;

    if (!fromAgentId || !toAgentId || !amount || !chain) {
      return res.status(400).json({
        error: 'Missing required fields: fromAgentId, toAgentId, amount, chain',
      });
    }

    if (fromAgentId === toAgentId) {
      return res.status(400).json({ error: 'Agent cannot tip itself' });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    await agentCore.AgentControls.initStore(fromAgentId, userId);

    const recipientAddress = await resolveAgentAddress(chain);
    const { parseEther } = require('viem');
    const amountWei = parseEther(amount);

    const validation = agentCore.AgentControls.validateAction({
      agentId: fromAgentId,
      userId,
      actionType: 'tip',
      amount: amountWei,
      amountFormatted: `${amount} ${token || 'cUSD'}`,
      description: `Agent tip: ${fromAgentId} → ${toAgentId}`,
      recipient: recipientAddress || undefined,
    });

    if (validation.requiresApproval) {
      return res.status(402).json({
        success: false,
        approvalRequired: true,
        approvalRequest: validation.approvalRequest
          ? {
              id: validation.approvalRequest.id,
              amount: validation.approvalRequest.amount,
              description: validation.approvalRequest.description,
              expiresAt: validation.approvalRequest.expiresAt,
            }
          : undefined,
      });
    }

    if (!validation.allowed) {
      return res.status(403).json({
        success: false,
        error: validation.reason || 'Agent tip not allowed',
      });
    }

    const fromAddress = await resolveAgentAddress(chain);
    const toAddress = await resolveAgentAddress(chain);

    if (!fromAddress) {
      return res.status(503).json({ error: 'Tipping agent wallet not available' });
    }

    if (!toAddress) {
      return res.status(503).json({ error: 'Recipient agent wallet not available' });
    }

    const crypto = require('crypto');
    const tipId = `a2a_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const tipToken = token || (chain === 'celo' ? 'cUSD' : 'USDT');

    // Resolve signer client or fall back to ledger-only mode
    const signerClient = agentCore.getSignerClient();
    const agentPrivateKey = !signerClient ? process.env.AGENT_PRIVATE_KEY : null;

    let txHash = null;
    let tipStatus = 'pending';

    if (signerClient) {
      // Execute actual on-chain transfer via isolated signer
      const tokenAddress = tipToken === 'G$'
        ? agentCore.getTokenAddress?.('GOOD_DOLLAR', chain)
        : agentCore.ERC20?.getCUSDAddress?.(chain);
      if (tokenAddress) {
        const signerResult = await signerClient.signTransfer({
          chain,
          tokenAddress,
          to: toAddress,
          amountWei: amountWei.toString(),
          action: 'tip',
          agentId: fromAgentId,
          userId,
          suggestionId: tipId,
          description: `Agent tip: ${fromAgentId} → ${toAgentId}`,
        });

        if (signerResult.success) {
          txHash = signerResult.txHash;
          tipStatus = 'completed';
        }
      }
    } else if (agentPrivateKey) {
      // Fallback: sign directly with AGENT_PRIVATE_KEY (dev mode)
      const tokenAddress = tipToken === 'G$'
        ? agentCore.getTokenAddress?.('GOOD_DOLLAR', chain)
        : agentCore.ERC20?.getCUSDAddress?.(chain);
      if (tokenAddress) {
        try {
          const transferResult = await agentCore.ERC20.transfer({
            chain,
            tokenAddress,
            to: toAddress,
            amount: amountWei,
            privateKey: agentPrivateKey,
          });
          txHash = transferResult.hash;
          tipStatus = 'completed';
        } catch (err) {
          logger.warn('Tip transfer failed, recording as pending', { component: 'tip-agent' }, err);
        }
      }
    }

    const tipRecord = {
      id: tipId,
      fromAgentId,
      toAgentId,
      fromAddress,
      toAddress,
      amount,
      chain,
      token: tipToken,
      timestamp: Date.now(),
      message,
      status: tipStatus,
      txHash,
    };

    const ledger = await getAgentTipLedger();
    ledger.push(tipRecord);
    await saveAgentTipLedger(ledger);

    agentCore.AgentControls.recordSpending(fromAgentId, userId, 'tip', amountWei);

    logger.info('Recorded agent-to-agent tip', {
      component: 'tip-agent',
      fromAgentId,
      toAgentId,
      amount,
      token: tipToken,
      chain,
      from: `${fromAddress.slice(0, 6)}...${fromAddress.slice(-4)}`,
      to: `${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
      txHash,
      status: tipStatus,
    });

    // Record metrics for KPI dashboard (GoodBuilders S4)
    if (countAction) {
      const actionType = tipToken === 'G$' ? 'tip_g$' : 'tip';
      countAction(actionType, tipStatus === 'completed' ? 'succeeded' : 'failed');
    }

    res.json({
      success: true,
      tip: {
        id: tipId,
        fromAgentId,
        toAgentId,
        amount,
        token: tipToken,
        chain,
        fromAddress,
        toAddress,
        status: tipStatus,
        txHash,
        timestamp: tipRecord.timestamp,
      },
      agentResponse: tipStatus === 'completed'
        ? `${toAgentId} received your ${amount} ${tipToken} tip!`
        : (message
          ? `${toAgentId} will receive your ${amount} ${tipToken} tip: "${message}" (pending)`
          : `${toAgentId} will receive your ${amount} ${tipToken} tip (pending)`),
    });
  } catch (error) {
    logger.error('Agent-to-agent tip failed', { component: 'tip-agent' }, error);
    res.status(500).json({ error: 'Failed to process agent tip' });
  }
});

// ── GET /api/agent/tip-agent — List tip ledger + stats ──

router.get('/', async (req, res) => {
  try {
    const ledger = await getAgentTipLedger();
    const wallet = await agentCore.getAgentWallet();
    const addresses = await wallet.getAddresses();

    const totalVolume = ledger.reduce((sum, tip) => sum + parseFloat(tip.amount), 0);

    res.json({
      agentAddresses: addresses,
      totalAgentTips: ledger.length,
      totalVolume: totalVolume.toString(),
      recentAgentTips: ledger.slice(-10).reverse(),
    });
  } catch (error) {
    logger.error('Failed to load agent tip stats', { component: 'tip-agent' }, error);
    res.status(500).json({ error: 'Failed to get agent tip info' });
  }
});

module.exports = router;
