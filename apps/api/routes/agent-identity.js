/**
 * Agent Identity Route — /api/agent/identity
 *
 * Returns the unified agent identity combining ERC-8004
 * and Self Protocol registrations.
 *
 * Ported from apps/web/app/api/agent/identity/route.ts
 *
 * Auth: None (public read for transparency)
 */

const express = require('express');
const router = express.Router();
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');

// GET /api/agent/identity
router.get('/', async (req, res) => {
  try {
    const erc8004Identity = await agentCore.getAgentIdentity().catch(() => ({
      agentId: 'unknown',
      walletAddress: '',
      receiptCount: 0,
    }));

    const unified = await agentCore.getUnifiedAgentIdentity?.(
      erc8004Identity.walletAddress,
      erc8004Identity.agentId,
    ).catch(() => null);

    const walletAddress = erc8004Identity.walletAddress;

    res.json({
      agent: {
        name: 'OnPoint AI Stylist',
        agentId: erc8004Identity.agentId,
        walletAddress,
      },
      registrations: {
        erc8004: {
          agentId: unified?.erc8004?.agentId || erc8004Identity.agentId,
          registryAddress: unified?.erc8004?.registryAddress || erc8004Identity.registryAddress || '',
          registrationTxHash: unified?.erc8004?.registrationTxHash || erc8004Identity.registrationTxHash || null,
          receiptCount: erc8004Identity.receiptCount || 0,
        },
        self: {
          selfAgentId: unified?.self?.selfAgentId || null,
          status: unified?.self?.status || 'unregistered',
          attestationHash: unified?.self?.attestationHash || null,
        },
      },
      compliance: {
        erc8004: true,
        selfAgentId: unified?.self?.status === 'verified' || unified?.self?.status === 'pending',
        walletOnchain: !!walletAddress,
      },
      links: {
        erc8004Registry: (unified?.erc8004?.registryAddress || erc8004Identity.registryAddress)
          ? `https://celoscan.io/address/${unified?.erc8004?.registryAddress || erc8004Identity.registryAddress}`
          : null,
        selfProtocol: 'https://self.xyz',
        celoscan: walletAddress ? `https://celoscan.io/address/${walletAddress}` : null,
      },
    });
  } catch (error) {
    logger.error('Agent identity error', { component: 'identity' }, error);
    res.status(500).json({ error: 'Failed to load agent identity' });
  }
});

module.exports = router;
