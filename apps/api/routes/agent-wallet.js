/**
 * Agent Wallet Route — /api/agent/wallet
 *
 * Exposes the AI Agent's self-custodial wallet capabilities:
 * addresses, balances, and optional backend OWS wallet info.
 *
 * Ported from apps/web/app/api/agent/wallet/route.ts
 *
 * Auth: SERVICE_API_KEY (service-to-service)
 */

const express = require('express');
const router = express.Router();
const { createPublicClient, http, formatEther, parseEther } = require('viem');
const { celo } = require('viem/chains');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');

const POLICY_ACTIONS = ['external_search', 'external_purchase', 'purchase', 'tip', 'mint'];
const DEFAULT_AGENT_ID = 'onpoint-stylist';

function formatPolicyAmount(amount) {
  return Number(formatEther(amount));
}

// GET /api/agent/wallet
router.get('/', async (req, res) => {
  try {
    const [walletInfo, owsInfo] = await Promise.all([
      agentCore.getAgentWalletInfo().catch(() => ({
        addresses: { celo: '' },
        walletInfo: [],
        wdkAvailable: false,
      })),
      agentCore.getOWSWalletInfo().catch(() => null),
    ]);

    const celoAddress = walletInfo.addresses?.treasury || walletInfo.addresses?.celo || '';
    const userId = req.query.userId || 'system';
    await agentCore.AgentControls.initStore(DEFAULT_AGENT_ID, userId);
    const limits = agentCore.AgentControls.getAgentLimits(DEFAULT_AGENT_ID, userId);
    const prefs = agentCore.AgentControls.getStylePreferences(userId);
    const policyLimits = POLICY_ACTIONS.map((action) => {
      const limit = limits.find((item) => item.actionType === action);
      return {
        action,
        daily: limit ? formatPolicyAmount(limit.dailyLimit) : 0,
        perAction: limit ? formatPolicyAmount(limit.perActionLimit) : 0,
        remaining: limit
          ? formatPolicyAmount(
              limit.dailyLimit > limit.spentToday ? limit.dailyLimit - limit.spentToday : 0n,
            )
          : 0,
        requiresApproval: limit?.requiresApproval ?? true,
      };
    });
    const capabilities = [
      'multi_chain_wallet',
      'receive_tips',
      'execute_payments',
      'nft_minting',
      'spending_controls',
      'verifiable_receipts',
    ];
    if (owsInfo) capabilities.push('policy_gated_signing', 'x402_compatible');

    // Onchain CELO balance
    let celoBalance = '0';
    let cUSDBalance = '0';

    if (celoAddress) {
      try {
        const publicClient = createPublicClient({
          chain: celo,
          transport: agentCore.createTransport('celo'),
        });

        const balance = await publicClient.getBalance({ address: celoAddress });
        celoBalance = formatEther(balance);

        const cUSD = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
        const cUSDBal = await publicClient.readContract({
          address: cUSD,
          abi: [{
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
          }],
          functionName: 'balanceOf',
          args: [celoAddress],
        });
        cUSDBalance = formatEther(cUSDBal);
      } catch (e) {
        logger.warn('Failed to fetch onchain balances', { component: 'wallet' }, e);
      }
    }

    res.json({
      agent: {
        name: 'OnPoint AI Stylist',
        description: 'Autonomous fashion styling agent with self-custodial wallet',
        capabilities,
      },
      wallets: walletInfo.walletInfo || [],
      addresses: walletInfo.addresses || {},
      supportedChains: ['Celo', 'Base', 'Ethereum', 'Polygon'],
      policy: {
        autonomyThreshold: formatPolicyAmount(agentCore.AgentControls.getAutonomyThreshold(DEFAULT_AGENT_ID, userId)),
        allowedActions: POLICY_ACTIONS,
        limits: policyLimits,
        autoBuy: {
          enabled: (prefs.autoBuyMaxPrice || 0) > 0,
          maxPrice: prefs.autoBuyMaxPrice || 0,
        },
        enforcement: {
          appLayer: true,
          signingLayer: !!owsInfo,
        },
      },
      onchain: {
        celoAddress,
        celoBalance,
        cUSDBalance,
        gasHealthy: parseFloat(celoBalance) > 0.5,
      },
      ows: owsInfo
        ? { available: true, wallet: owsInfo.name, accounts: owsInfo.accounts }
        : { available: false },
    });
  } catch (error) {
    logger.error('Agent wallet error', { component: 'wallet' }, error);
    res.status(500).json({ error: 'Failed to get agent wallet info' });
  }
});

// PATCH /api/agent/wallet — Update supported spending policy settings
router.patch('/', async (req, res) => {
  const userId = req.query.userId || req.body?.userId || 'system';
  const { autonomyThreshold, autoBuyMaxPrice } = req.body || {};

  try {
    await agentCore.AgentControls.initStore(DEFAULT_AGENT_ID, userId);

    if (autonomyThreshold !== undefined) {
      if (
        typeof autonomyThreshold !== 'number' ||
        autonomyThreshold < 0 ||
        autonomyThreshold > 10000
      ) {
        return res.status(400).json({
          success: false,
          error: 'autonomyThreshold must be a number between 0 and 10000',
        });
      }

      agentCore.AgentControls.setAutonomyThreshold(
        DEFAULT_AGENT_ID,
        userId,
        parseEther(String(autonomyThreshold)),
      );
    }

    if (autoBuyMaxPrice !== undefined) {
      if (
        typeof autoBuyMaxPrice !== 'number' ||
        autoBuyMaxPrice < 0 ||
        autoBuyMaxPrice > 10000
      ) {
        return res.status(400).json({
          success: false,
          error: 'autoBuyMaxPrice must be a number between 0 and 10000',
        });
      }

      agentCore.AgentControls.updateStylePreferences(userId, { autoBuyMaxPrice });
    }

    res.json({
      success: true,
      userId,
      autonomyThreshold: formatPolicyAmount(
        agentCore.AgentControls.getAutonomyThreshold(DEFAULT_AGENT_ID, userId),
      ),
      autoBuyMaxPrice:
        agentCore.AgentControls.getStylePreferences(userId).autoBuyMaxPrice || 0,
    });
  } catch (error) {
    logger.error('Agent policy update error', { component: 'wallet' }, error);
    res.status(500).json({ success: false, error: 'Failed to update agent policy' });
  }
});

module.exports = router;
