/**
 * Agent Mint Route — /api/agent/mint
 *
 * Allows the AI Agent to mint NFTs on behalf of users.
 * Uses @repo/agent-core for wallet, @repo/blockchain-client for minting.
 *
 * Ported from apps/web/app/api/agent/mint/route.ts
 *
 * Auth: SERVICE_API_KEY + forwarded user context
 */

const express = require('express');
const router = express.Router();
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

router.use(forwardedUser);

function validateMintBody(body) {
  const errors = [];
  if (!body.userAddress || !/^0x[a-fA-F0-9]{40}$/.test(body.userAddress)) {
    errors.push('userAddress must be a valid 0x address');
  }
  if (!body.metadataUri || typeof body.metadataUri !== 'string') {
    errors.push('metadataUri is required');
  }
  return errors.length ? errors.join('; ') : null;
}

// POST /api/agent/mint — Mint an NFT
router.post('/', async (req, res) => {
  const userId = req.userContext.userId || 'anonymous';
  const agentId = req.body.agentId || req.userContext.agentId || 'onpoint-stylist';

  const validationError = validateMintBody(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  const {
    userAddress,
    metadataUri,
    royaltyRecipient,
    royaltyBps = 500,
    chain = 'celo',
    approvalId,
  } = req.body;

  try {
    await agentCore.AgentControls.initStore(agentId, userId);

    // Check if NFT contract exists on this chain
    const nftContract = agentCore.NFT_CONTRACTS?.[chain];
    if (!nftContract) {
      return res.status(400).json({ success: false, error: `NFT contract not deployed on ${chain}` });
    }

    const { parseEther } = require('viem');
    const estimatedGasWei = parseEther('0.01');
    const royaltyAddr = royaltyRecipient || userAddress;

    // Validate against spending limits
    const validation = agentCore.AgentControls.validateAction({
      agentId,
      userId,
      actionType: 'mint',
      amount: estimatedGasWei,
      amountFormatted: '~0.01 CELO (gas)',
      description: `Mint NFT for ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`,
      recipient: userAddress,
    });

    if (validation.requiresApproval) {
      return res.status(402).json({
        success: false,
        approvalRequired: true,
        approvalRequest: validation.approvalRequest
          ? { id: validation.approvalRequest.id, amount: validation.approvalRequest.amount, description: validation.approvalRequest.description, expiresAt: validation.approvalRequest.expiresAt }
          : undefined,
      });
    }

    if (!validation.allowed) {
      return res.status(403).json({ success: false, error: validation.reason || 'Action not allowed' });
    }

    if (approvalId) {
      const approval = agentCore.AgentControls.getApprovalRequest(approvalId);
      if (!approval || approval.status !== 'approved') {
        return res.status(403).json({ success: false, error: 'Invalid or expired approval' });
      }
    }

    // Resolve signer client or fall back to AGENT_PRIVATE_KEY
    const signerClient = agentCore.getSignerClient();
    const agentPrivateKey = !signerClient ? process.env.AGENT_PRIVATE_KEY : null;

    if (!signerClient && !agentPrivateKey) {
      return res.status(503).json({
        success: false,
        error: 'Agent signing not configured. Set SIGNER_URL+SIGNER_API_KEY or AGENT_PRIVATE_KEY.',
        code: 'SIGNING_NOT_CONFIGURED',
      });
    }

    let result;

    if (signerClient) {
      // Delegate to isolated signer process
      const signerResult = await signerClient.signMint({
        chain,
        nftContract: nftContract,
        metadataUri,
        recipients: [
          { address: royaltyAddr, percentAllocation: 85 },
          { address: agentCore.PLATFORM_WALLET || agentCore.AGENT_WALLET, percentAllocation: 15 },
        ],
        agentId,
        userId,
        suggestionId: `mint_${Date.now()}`,
      });

      if (!signerResult.success) {
        return res.status(403).json({ success: false, error: signerResult.error, code: signerResult.code });
      }

      result = {
        transactionHash: signerResult.txHash,
        tokenId: signerResult.tokenId,
        splitAddress: null,
      };
    } else {
      // Fallback: sign directly with AGENT_PRIVATE_KEY (dev mode)
      const { createPublicClient, createWalletClient, http } = require('viem');
      const { celo } = require('viem/chains');
      const blockchainClient = require('@repo/blockchain-client');

      const chainConfig = chain === 'celoSepolia'
        ? (agentCore.celoSepolia || celo)
        : celo;

      const rpcUrl = 'https://forno.celo.org';

      const publicClient = createPublicClient({
        chain: chainConfig,
        transport: http(rpcUrl),
      });

      const walletClient = createWalletClient({
        account: agentPrivateKey,
        chain: chainConfig,
        transport: http(rpcUrl),
      });

      const splitsClient = blockchainClient.createSplitsClient(
        chainConfig.id,
        publicClient,
        walletClient,
      );

      result = await blockchainClient.mintNFTWithSplit(
        walletClient,
        publicClient,
        nftContract,
        metadataUri,
        {
          recipients: [
            { address: royaltyAddr, percentAllocation: 85 },
            { address: agentCore.PLATFORM_WALLET || agentCore.AGENT_WALLET, percentAllocation: 15 },
          ],
        },
        splitsClient,
      );

      // Record spending (signer does this when using signer client)
      agentCore.AgentControls.recordSpending(agentId, userId, 'mint', estimatedGasWei);
    }

    // Record verifiable receipt
    try {
      await agentCore.recordReceipt({
        action: 'mint_nft',
        sessionId: `mint_${Date.now()}`,
        metadata: { userAddress, tokenId: result.tokenId, chain, splitAddress: result.splitAddress, royaltyRecipient: royaltyAddr },
        txHash: result.transactionHash,
        chain,
        onChain: true,
      });
    } catch (receiptErr) {
      logger.warn('Failed to record mint receipt', { component: 'mint' }, receiptErr);
    }

    res.json({
      success: true,
      mint: {
        hash: result.transactionHash,
        tokenId: result.tokenId,
        chain,
        explorerUrl: agentCore.getExplorerUrl?.(chain, result.transactionHash) || `https://celoscan.io/tx/${result.transactionHash}`,
        splitAddress: result.splitAddress,
      },
    });
  } catch (error) {
    logger.error('Mint API error', { component: 'mint' }, error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
