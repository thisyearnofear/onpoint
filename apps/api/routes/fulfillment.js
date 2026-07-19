/**
 * Fulfillment Routes — /api/orders
 *
 * Endpoints for the order fulfillment lifecycle:
 *   confirmed → shipped → delivered → (disputed → resolved)
 *   confirmed → cancelled (stock race)
 *
 * These are called by the curator (via admin) or the platform operator.
 * All mutations are atomic DB updates with status guards.
 */

const express = require('express');
const { eq, and } = require('drizzle-orm');
const { orders, curators } = require('@repo/db');
const agentCore = require('@repo/agent-core');
const sharedTypes = require('@onpoint/shared-types');
const logger = require('../lib/logger');
const { distributeSplit } = require('../lib/split-setup');
const { getDb } = require('../lib/db');

const router = express.Router();

// ── POST /api/orders/record — record a fiat (M-Pesa) order ──
//
// Called service-to-service by the web app's STK callback when Safaricom
// confirms a payment. This is what makes the Postgres orders table the
// single ledger: agent orders arrive via /api/curator/:slug/order, human
// M-Pesa orders arrive here. Idempotent on the unique M-Pesa receipt —
// Safaricom retries callbacks, and a receipt can only ever be one order.
//
// Body: { curatorSlug, listingId, size, amountKes, mpesaReceipt,
//         customerPhone?, quantity?, source? ('site_buy') }
router.post('/record', async (req, res) => {
  const {
    curatorSlug, listingId, size, amountKes, mpesaReceipt,
    customerPhone, quantity = 1, source = 'site_buy',
  } = req.body || {};

  if (!curatorSlug || !/^[a-z0-9-]{2,64}$/.test(String(curatorSlug))) {
    return res.status(400).json({ error: 'curatorSlug is required' });
  }
  if (!listingId || typeof listingId !== 'string') {
    return res.status(400).json({ error: 'listingId is required' });
  }
  if (!size || typeof size !== 'string') {
    return res.status(400).json({ error: 'size is required' });
  }
  if (!mpesaReceipt || typeof mpesaReceipt !== 'string' || mpesaReceipt.length > 40) {
    return res.status(400).json({ error: 'mpesaReceipt is required (unique M-Pesa code)' });
  }
  const kes = Number(amountKes);
  if (!Number.isFinite(kes) || kes <= 0) {
    return res.status(400).json({ error: 'amountKes must be a positive number' });
  }
  if (!['site_buy', 'whatsapp_deeplink'].includes(source)) {
    return res.status(400).json({ error: 'source must be site_buy or whatsapp_deeplink' });
  }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
    return res.status(400).json({ error: 'quantity must be an integer between 1 and 10' });
  }

  try {
    const db = getDb({ orders, curators });
    const inserted = await db
      .insert(orders)
      .values({
        curatorSlug,
        listingId,
        size,
        quantity: qty,
        customerPhone: customerPhone || null,
        amountKes: kes.toFixed(0),
        mpesaReceipt,
        source,
        status: 'confirmed',
      })
      .onConflictDoNothing({ target: orders.mpesaReceipt })
      .returning({ id: orders.id });

    if (inserted.length === 0) {
      // Callback retry — the receipt is already ledgered. Report success.
      const [existing] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.mpesaReceipt, mpesaReceipt))
        .limit(1);
      return res.status(200).json({ success: true, idempotent: true, orderId: existing?.id });
    }

    logger.info('M-Pesa order recorded in ledger', {
      component: 'fulfillment',
      orderId: inserted[0].id,
      curatorSlug,
      mpesaReceipt,
      amountKes: String(kes),
    });
    return res.status(201).json({ success: true, orderId: inserted[0].id });
  } catch (err) {
    // FK violations mean the slug/listing doesn't exist — client error, not 500
    if (String(err?.message || '').includes('foreign key')) {
      return res.status(404).json({ error: 'Unknown curator or listing' });
    }
    logger.error('Failed to record M-Pesa order', { component: 'fulfillment', curatorSlug }, err);
    return res.status(500).json({ error: 'Failed to record order' });
  }
});

// ── GET /api/orders/:id — get order status ──
router.get('/:id', async (req, res) => {
  try {
    const db = getDb({ orders, curators });
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (err) {
    logger.error('Failed to get order', { component: 'fulfillment', id: req.params.id }, err);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// ── POST /api/orders/:id/ship — mark as shipped ──
// Body: { trackingNumber?: string }
router.post('/:id/ship', async (req, res) => {
  const { trackingNumber } = req.body || {};
  try {
    const db = getDb({ orders, curators });
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'confirmed') {
      return res.status(409).json({ error: `Cannot ship order in status: ${order.status}` });
    }

    const [updated] = await db
      .update(orders)
      .set({
        status: 'shipped',
        trackingNumber: trackingNumber || null,
        shippedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, req.params.id))
      .returning();

    logger.info('Order shipped', { component: 'fulfillment', orderId: req.params.id, trackingNumber });
    res.json({ order: updated });
  } catch (err) {
    logger.error('Failed to ship order', { component: 'fulfillment', id: req.params.id }, err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ── POST /api/orders/:id/deliver — mark as delivered ──
// Can be called by curator, platform, or auto-released by the worker after N days.
router.post('/:id/deliver', async (req, res) => {
  try {
    const db = getDb({ orders, curators });
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'shipped') {
      return res.status(409).json({ error: `Cannot deliver order in status: ${order.status}` });
    }

    const [updated] = await db
      .update(orders)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, req.params.id))
      .returning();

    logger.info('Order delivered', { component: 'fulfillment', orderId: req.params.id });

    // If using 0xSplits, trigger distribution now that delivery is confirmed
    // (escrow release). For custodial flow, the payout already happened at
    // confirmation time — this is just a status update.
    if (order.paymentTxHash && !order.payoutTxHash) {
      // Check if curator has a split address
      const [curator] = await db.select().from(curators).where(eq(curators.slug, order.curatorSlug)).limit(1);
      const splitAddress = curator?.commerce?.splitAddress;
      if (splitAddress) {
        try {
          const result = await distributeSplit(splitAddress, sharedTypes.X402_ASSET);
          if (result) {
            await db.update(orders).set({ payoutTxHash: result.txHash }).where(eq(orders.id, req.params.id));
            logger.info('Split distributed after delivery', {
              component: 'fulfillment', orderId: req.params.id, txHash: result.txHash,
            });
          }
        } catch (distErr) {
          logger.error('Split distribution failed after delivery — worker will retry', {
            component: 'fulfillment', orderId: req.params.id,
          }, distErr);
        }
      }
    }

    res.json({ order: updated });
  } catch (err) {
    logger.error('Failed to deliver order', { component: 'fulfillment', id: req.params.id }, err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ── POST /api/orders/:id/dispute — open a dispute ──
// Body: { reason: string }
router.post('/:id/dispute', async (req, res) => {
  const { reason } = req.body || {};
  if (!reason || typeof reason !== 'string') {
    return res.status(400).json({ error: 'Dispute reason is required' });
  }
  try {
    const db = getDb({ orders, curators });
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['shipped', 'delivered'].includes(order.status)) {
      return res.status(409).json({ error: `Cannot dispute order in status: ${order.status}` });
    }

    const [updated] = await db
      .update(orders)
      .set({
        status: 'disputed',
        disputeReason: reason,
        disputeOpenedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, req.params.id))
      .returning();

    logger.warn('Dispute opened', { component: 'fulfillment', orderId: req.params.id, reason });
    res.json({ order: updated });
  } catch (err) {
    logger.error('Failed to open dispute', { component: 'fulfillment', id: req.params.id }, err);
    res.status(500).json({ error: 'Failed to open dispute' });
  }
});

// ── POST /api/orders/:id/resolve — resolve a dispute ──
// Body: { resolution: 'refund'|'partial_refund'|'reship'|'closed_favor_curator'|'closed_favor_buyer' }
router.post('/:id/resolve', async (req, res) => {
  const { resolution } = req.body || {};
  const validResolutions = ['refund', 'partial_refund', 'reship', 'closed_favor_curator', 'closed_favor_buyer'];
  if (!validResolutions.includes(resolution)) {
    return res.status(400).json({ error: `resolution must be one of: ${validResolutions.join(', ')}` });
  }
  try {
    const db = getDb({ orders, curators });
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'disputed') {
      return res.status(409).json({ error: `Cannot resolve order in status: ${order.status}` });
    }

    const newStatus = resolution === 'reship' ? 'confirmed' : 'resolved';
    const [updated] = await db
      .update(orders)
      .set({
        status: newStatus,
        disputeResolution: resolution,
        disputeResolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, req.params.id))
      .returning();

    logger.info('Dispute resolved', { component: 'fulfillment', orderId: req.params.id, resolution });
    res.json({ order: updated });
  } catch (err) {
    logger.error('Failed to resolve dispute', { component: 'fulfillment', id: req.params.id }, err);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

module.exports = router;
