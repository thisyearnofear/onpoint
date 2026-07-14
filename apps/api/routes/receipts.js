/**
 * Receipts Route — /api/receipts/:id
 *
 * Public read-only lookup for verifiable agent receipts (ERC-8004).
 * Powers the branded receipt page at /r/{receiptId}.
 *
 * Auth: None (public — receipts are verifiable, transparent records).
 */

const express = require('express');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');

const router = express.Router();

router.get('/:id', async (req, res) => {
  const id = String(req.params.id || '');
  if (!id || id.length > 128) {
    return res.status(400).json({ error: 'Invalid receipt ID' });
  }

  try {
    const receipt = await agentCore.getReceipt(id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json({ receipt });
  } catch (err) {
    logger.error('Failed to fetch receipt', { component: 'receipts', id }, err);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

module.exports = router;
