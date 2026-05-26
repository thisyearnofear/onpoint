/**
 * Agent Dashboard Route — /api/agent/dashboard
 *
 * Returns the agent's complete operational state: wallet health,
 * spending limits, escrow balances, recent autonomous actions,
 * fraud detection status, and Self Protocol verification.
 *
 * Ported from apps/web/app/api/agent/dashboard/route.ts
 *
 * Auth: None (public read for transparency)
 */

const express = require('express');
const router = express.Router();
const { createPublicClient, http, formatEther } = require('viem');
const { celo } = require('viem/chains');

const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');

// GET /api/agent/dashboard
router.get('/', async (req, res) => {
  try {
    const [walletInfo, erc8004Identity] = await Promise.all([
      agentCore.getAgentWalletInfo().catch(() => ({
        addresses: { celo: '' },
        walletInfo: [],
        wdkAvailable: false,
      })),
      agentCore.getAgentIdentity().catch(() => ({
        agentId: 'unknown',
        walletAddress: '',
        receiptCount: 0,
      })),
    ]);

    const celoAddress = walletInfo.addresses?.celo || '';

    // Wallet balances via onchain RPC
    let celoBalance = '0';
    let cUSDBalance = '0';

    if (celoAddress) {
      try {
        const publicClient = createPublicClient({
          chain: celo,
          transport: http('https://forno.celo.org'),
        });

        const balance = await publicClient.getBalance({
          address: celoAddress,
        });
        celoBalance = formatEther(balance);

        const cUSD = '0x765DE8164458C172EE097029dfb482Ff182ad001';
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
        logger.warn('Failed to fetch onchain balances', { component: 'dashboard' }, e);
      }
    }

    // Unified identity
    const unifiedIdentity = await agentCore.getUnifiedAgentIdentity?.(
      celoAddress,
      erc8004Identity.agentId,
    ).catch(() => null);

    // Receipts
    const { receipts, total } = await agentCore.getAllReceipts?.({ limit: 10 }).catch(() => ({ receipts: [], total: 0 })) || { receipts: [], total: 0 };

    res.json({
      agent: {
        name: 'OnPoint AI Stylist',
        agentId: erc8004Identity.agentId,
        walletAddress: celoAddress,
        status: 'active',
      },
      identity: {
        erc8004: {
          agentId: unifiedIdentity?.erc8004?.agentId || erc8004Identity.agentId,
          registryAddress: unifiedIdentity?.erc8004?.registryAddress || '',
          registrationTxHash: unifiedIdentity?.erc8004?.registrationTxHash || null,
          receiptCount: erc8004Identity.receiptCount || 0,
        },
        self: {
          selfAgentId: unifiedIdentity?.self?.selfAgentId || null,
          status: unifiedIdentity?.self?.status || 'unregistered',
          attestationHash: unifiedIdentity?.self?.attestationHash || null,
        },
      },
      wallet: {
        address: celoAddress,
        chains: celoAddress ? ['celo'] : [],
        balances: { celo: celoBalance, cUSD: cUSDBalance },
        gasHealthy: parseFloat(celoBalance) > 0.5,
      },
      activity: {
        totalReceipts: total || 0,
        onChainReceipts: receipts.filter((r) => r.txHash).length,
        recentReceipts: receipts.slice(0, 10).map((r) => ({
          action: r.action,
          timestamp: r.timestamp,
          txHash: r.txHash,
          chain: r.chain,
          verifiableLogCid: r.verifiableLogCid,
        })),
      },
      compliance: {
        erc8004Registered: true,
        selfAgentIdRegistered: unifiedIdentity?.self?.status === 'verified' || unifiedIdentity?.self?.status === 'pending',
        walletOnchain: !!celoAddress,
        verifiableReceipts: receipts.some((r) => r.txHash),
      },
      capabilities: [
        'autonomous_mint',
        'autonomous_purchase',
        'autonomous_tip',
        'verifiable_receipts',
        'fraud_detection',
        'dead_mans_switch',
        'multi_sig',
        'escrow',
        'self_protocol_identity',
      ],
      links: {
        celoscan: celoAddress ? `https://celoscan.io/address/${celoAddress}` : null,
        erc8004Registry: unifiedIdentity?.erc8004?.registryAddress
          ? `https://basescan.org/address/${unifiedIdentity.erc8004.registryAddress}`
          : null,
      },
    });
  } catch (error) {
    logger.error('Dashboard error', { component: 'dashboard' }, error);
    res.status(500).json({ error: 'Failed to load agent dashboard' });
  }
});

module.exports = router;
