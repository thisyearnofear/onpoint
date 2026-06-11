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
const { createPublicClient, http, formatEther } = require('viem');
const { celo } = require('viem/chains');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');

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

    const celoAddress = walletInfo.addresses?.celo || '';
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
          transport: http('https://forno.celo.org'),
        });

        const balance = await publicClient.getBalance({ address: celoAddress });
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

module.exports = router;
