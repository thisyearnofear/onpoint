/**
 * Agent Purchase Route — /api/agent/purchase
 *
 * Allows the AI Agent to execute purchases on behalf of users.
 * Uses @repo/agent-core for wallet, ERC20 transfers, and receipts.
 *
 * Ported from apps/web/app/api/agent/purchase/route.ts
 *
 * Auth: SERVICE_API_KEY + forwarded user context
 */

const express = require('express');
const router = express.Router();
const { parseEther } = require('viem');
const sharedTypes = require('@onpoint/shared-types');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

// Build product catalog from CANVAS_ITEMS
const PLATFORM_WALLET = agentCore.PLATFORM_WALLET || '0x5b33E63440e95289207120B94da78CE22F9D24fB';
const PRODUCTS = Object.fromEntries(
  (sharedTypes.CANVAS_ITEMS || []).map((item) => [
    item.slug,
    {
      id: item.slug,
      name: item.name,
      price: item.price.toString(),
      seller: PLATFORM_WALLET,
      category: item.category,
    },
  ]),
);

router.use(forwardedUser);

function validatePurchaseBody(body) {
  const errors = [];

  // CASE 2: Internal product purchase
  if (!body.actionType || body.actionType !== 'external_search') {
    if (!body.productId) errors.push('productId is required for internal purchases');
  }

  // CASE 1: External search
  if (body.actionType === 'external_search') {
    if (!body.query) errors.push('query is required for external search');
    if (!body.suggestionId) errors.push('suggestionId is required for external search');
  }

  return errors.length ? errors.join('; ') : null;
}

// POST /api/agent/purchase — Execute a purchase
router.post('/', async (req, res) => {
  const userId = req.userContext.userId || 'anonymous';
  const agentId = req.body.agentId || req.userContext.agentId || 'onpoint-stylist';

  const validationError = validatePurchaseBody(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  const {
    productId, actionType, query, suggestionId,
    quantity = 1, chain = 'celo', approvalId,
  } = req.body;

  try {
    await agentCore.AgentControls.initStore(agentId, userId);

    // CASE 1: External Search
    if (actionType === 'external_search' && query && suggestionId) {
      const result = await agentCore.AgentControls.dispatchExternalAction(userId, {
        type: 'search',
        payload: { query },
      }).catch(() => ({ success: false }));

      if (result.success && result.data?.items?.length > 0) {
        return res.json({ success: true });
      }

      return res.status(404).json({ success: false, error: 'Web-Bridge returned no results' });
    }

    // CASE 2: Internal Product Purchase
    const product = PRODUCTS[productId.toLowerCase()];
    if (!product) {
      return res.status(404).json({ success: false, error: `Product not found: ${productId}` });
    }

    // Check cUSD availability on chain
    const cUSDAddress = agentCore.ERC20?.getCUSDAddress?.(chain);
    if (!cUSDAddress) {
      return res.status(400).json({ success: false, error: `cUSD not available on ${chain}` });
    }

    // Calculate total
    const unitPriceWei = parseEther(product.price);
    const totalAmountWei = unitPriceWei * BigInt(quantity);
    const totalFormatted = `${parseFloat(product.price) * quantity} cUSD`;

    // Validate against spending limits
    const validation = agentCore.AgentControls.validateAction({
      agentId,
      userId,
      actionType: 'purchase',
      amount: totalAmountWei,
      amountFormatted: totalFormatted,
      description: `Purchase ${quantity}x ${product.name}`,
      recipient: product.seller,
    });

    if (validation.requiresApproval) {
      return res.status(402).json({
        success: false,
        approvalRequired: true,
        approvalRequest: validation.approvalRequest ? {
          id: validation.approvalRequest.id,
          amount: validation.approvalRequest.amount,
          description: validation.approvalRequest.description,
          expiresAt: validation.approvalRequest.expiresAt,
        } : undefined,
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

    // Check agent private key
    const agentPrivateKey = process.env.AGENT_PRIVATE_KEY;
    if (!agentPrivateKey) {
      return res.status(503).json({
        success: false,
        error: 'Agent signing not configured. Set AGENT_PRIVATE_KEY to enable purchases.',
        code: 'SIGNING_NOT_CONFIGURED',
      });
    }

    // Execute cUSD transfer
    const transferResult = await agentCore.ERC20.transfer({
      chain,
      tokenAddress: cUSDAddress,
      to: product.seller,
      amount: totalAmountWei,
      privateKey: agentPrivateKey,
    });

    // Record spending
    agentCore.AgentControls.recordSpending(agentId, userId, 'purchase', totalAmountWei);

    const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Record verifiable receipt
    try {
      await agentCore.recordReceipt({
        action: 'propose_mint_nft',
        sessionId: purchaseId,
        metadata: { productId: product.id, productName: product.name, quantity, totalAmount: transferResult.amount, recipient: product.seller, chain },
        txHash: transferResult.hash,
        chain,
        onChain: true,
      });
    } catch (receiptErr) {
      logger.warn('Failed to record purchase receipt', { component: 'purchase' }, receiptErr);
    }

    res.json({
      success: true,
      purchase: {
        id: purchaseId,
        productId: product.id,
        productName: product.name,
        quantity,
        totalAmount: `${transferResult.amount} ${transferResult.symbol}`,
        txHash: transferResult.hash,
        chain,
        explorerUrl: agentCore.getExplorerUrl?.(chain, transferResult.hash) || `https://celoscan.io/tx/${transferResult.hash}`,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    logger.error('Purchase API error', { component: 'purchase' }, error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/agent/purchase — List available products
router.get('/', async (req, res) => {
  const category = req.query.category;
  let products = Object.values(PRODUCTS);
  if (category) {
    products = products.filter((p) => p.category === category);
  }
  res.json({ products });
});

module.exports = router;
