/**
 * Agent Checkout Route — /api/agent/checkout
 *
 * Processes cart checkout with cUSD payments, commission splits,
 * and x402 payment support.
 *
 * Ported from apps/web/app/api/agent/checkout/route.ts
 *
 * Auth: SERVICE_API_KEY + forwarded user context
 *
 * @typedef {import('express').Request} ExpressRequest
 * @typedef {import('express').Response} ExpressResponse
 * @typedef {import('@onpoint/shared-types').CuratorStorefrontResponse} CuratorStorefrontResponse
 * @typedef {import('@onpoint/shared-types').Order} Order
 * @typedef {{ productId: string, quantity: number }} CheckoutItem
 * @typedef {{ items: CheckoutItem[], agentId?: string }} CheckoutRequestBody
 * @typedef {{ success: boolean, orderId?: string, totalUsd?: string, payoutTxHash?: string, error?: string }} CheckoutResponse
 */

const express = require('express');
const router = express.Router();
const { parseEther } = require('viem');
const sharedTypes = require('@onpoint/shared-types');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

const PLATFORM_WALLET = agentCore.PLATFORM_WALLET || '0x5b33E63440e95289207120B94da78CE22F9D24fB';
const AGENT_WALLET = agentCore.AGENT_WALLET || PLATFORM_WALLET;

const PRODUCT_MAP = Object.fromEntries(
  (sharedTypes.CANVAS_ITEMS || []).map((item) => [
    item.id,
    {
      id: item.id,
      slug: item.slug,
      name: item.name,
      price: item.price,
      category: item.category,
      seller: PLATFORM_WALLET,
    },
  ]),
);

router.use(forwardedUser);

/**
 * Validates the checkout request body.
 * @param {any} body - The request body to validate.
 * @returns {string|null} Error message if invalid, null if valid.
 */
function validateCheckoutBody(body) {
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return 'items array is required with at least one item';
  }
  for (const item of body.items) {
    if (!item.productId) return 'each item must have a productId';
    if (!item.quantity || item.quantity < 1 || item.quantity > 10) {
      return 'each item must have quantity between 1 and 10';
    }
  }
  return null;
}

// POST /api/agent/checkout — Process checkout
router.post('/', async (req, res) => {
  const userId = req.userContext.userId || 'anonymous';
  const agentId = req.body.agentId || req.userContext.agentId || 'onpoint-stylist';

  const validationError = validateCheckoutBody(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  const { items, chain = 'celo', affiliateId, referringAgentId } = req.body;

  try {
    await agentCore.AgentControls.initStore(agentId, userId);

    // Validate all items and compute totals
    const resolvedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = PRODUCT_MAP[item.productId];
      if (!product) {
        return res.status(404).json({ success: false, error: `Product not found: ${item.productId}` });
      }

      const subtotal = product.price * item.quantity;
      totalAmount += subtotal;

      resolvedItems.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal,
        seller: product.seller,
      });
    }

    const totalWei = parseEther(totalAmount.toString());
    const totalFormatted = `${totalAmount} cUSD`;

    // Resolve affiliate/agent addresses
    let affiliateAddress;
    let agentAddress;

    if (affiliateId && affiliateId.startsWith('0x') && affiliateId.length === 42) {
      affiliateAddress = affiliateId;
    }

    if (referringAgentId) {
      agentAddress = AGENT_WALLET;
    }

    // Calculate commission split
    const split = agentCore.calculateSplit(totalWei, PLATFORM_WALLET, {
      affiliateAddress,
      agentAddress,
    });

    // Validate against spending limits
    const validation = agentCore.AgentControls.validateAction({
      agentId,
      userId,
      actionType: 'purchase',
      amount: totalWei,
      amountFormatted: totalFormatted,
      description: `Checkout: ${resolvedItems.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
      recipient: PLATFORM_WALLET,
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
      return res.status(403).json({ success: false, error: validation.reason || 'Checkout not allowed' });
    }

    // Check cUSD availability
    const cUSDAddress = agentCore.ERC20?.getCUSDAddress?.(chain);
    if (!cUSDAddress) {
      return res.status(400).json({ success: false, error: `cUSD not available on ${chain}` });
    }

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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

    // Execute cUSD transfers to each recipient
    const txHashes = [];

    for (const recipient of split.recipients) {
      if (recipient.amount === 0n) continue;

      if (signerClient) {
        const signerResult = await signerClient.signTransfer({
          chain,
          tokenAddress: cUSDAddress,
          to: recipient.address,
          amountWei: recipient.amount.toString(),
          action: 'purchase',
          agentId,
          userId,
          suggestionId: `${orderId}_${recipient.address.slice(0, 8)}`,
          description: `Checkout split: ${recipient.label}`,
        });

        if (!signerResult.success) {
          logger.warn('Checkout split transfer rejected by signer', {
            component: 'checkout',
            recipient: recipient.address,
            error: signerResult.error,
          });
          continue;
        }

        txHashes.push(signerResult.txHash);
      } else {
        const result = await agentCore.ERC20.transfer({
          chain,
          tokenAddress: cUSDAddress,
          to: recipient.address,
          amount: recipient.amount,
          privateKey: agentPrivateKey,
        });

        txHashes.push(result.hash);
      }
    }

    // Record spending (signer does this when using signer client)
    if (!signerClient) {
      agentCore.AgentControls.recordSpending(agentId, userId, 'purchase', totalWei);
    }

    // Record verifiable receipt
    try {
      await agentCore.recordReceipt({
        action: 'purchase',
        sessionId: orderId,
        metadata: {
          items: resolvedItems.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, subtotal: i.subtotal })),
          totalAmount,
          commissions: split.recipients.map((r) => ({ label: r.label, percentBps: r.percentBps, amount: r.amount.toString(), address: r.address })),
          chain,
        },
        txHash: txHashes[0] || '',
        chain,
        onChain: true,
      });
    } catch (receiptErr) {
      logger.warn('Failed to record checkout receipt', { component: 'checkout' }, receiptErr);
    }

    res.json({
      success: true,
      order: {
        id: orderId,
        items: resolvedItems.map(({ seller, ...item }) => item),
        totalAmount: totalFormatted,
        totalWei: totalWei.toString(),
        txHash: txHashes[0] || '',
        chain,
        explorerUrl: txHashes[0] ? (agentCore.getExplorerUrl?.(chain, txHashes[0]) || `https://celoscan.io/tx/${txHashes[0]}`) : '',
        commissions: split.recipients.map((r) => ({
          label: r.label,
          percentBps: r.percentBps,
          amount: (Number(r.amount) / 1e18).toFixed(2),
          address: r.address,
        })),
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    logger.error('Checkout error', { component: 'checkout' }, error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
