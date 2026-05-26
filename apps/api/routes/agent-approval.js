/**
 * Agent Approval Route — /api/agent/approval
 *
 * Manages approval requests for agent actions requiring user consent.
 * Supports creating, checking, approving, and rejecting requests.
 *
 * Ported from apps/web/app/api/agent/approval/route.ts
 *
 * Auth: SERVICE_API_KEY + forwarded user context
 */

const express = require('express');
const router = express.Router();
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

const VALID_ACTION_TYPES = ['tip', 'purchase', 'mint', 'premium', 'agent_to_agent'];
const VALID_UPDATE_ACTIONS = ['approve', 'reject'];

function validateCreateBody(body) {
  const errors = [];
  if (!body.actionType || !VALID_ACTION_TYPES.includes(body.actionType)) {
    errors.push(`actionType must be one of: ${VALID_ACTION_TYPES.join(', ')}`);
  }
  if (!body.amount || typeof body.amount !== 'string') errors.push('amount is required (string)');
  if (!body.description || typeof body.description !== 'string') errors.push('description is required (string)');
  return errors.length ? errors.join('; ') : null;
}

function validateUpdateBody(body) {
  const errors = [];
  if (!body.id || typeof body.id !== 'string') errors.push('id is required (string)');
  if (!body.action || !VALID_UPDATE_ACTIONS.includes(body.action)) {
    errors.push(`action must be one of: ${VALID_UPDATE_ACTIONS.join(', ')}`);
  }
  return errors.length ? errors.join('; ') : null;
}

router.use(forwardedUser);

// GET /api/agent/approval — List pending approvals or get one by ID
router.get('/', async (req, res) => {
  const agentId = req.query.agentId || req.userContext.agentId || 'onpoint-stylist';
  const userId = req.userContext.userId || 'anonymous';
  const approvalId = req.query.id;

  try {
    await agentCore.AgentControls.initStore(agentId, userId);

    if (approvalId) {
      const approvalRequest = agentCore.AgentControls.getApprovalRequest(approvalId);
      if (!approvalRequest) {
        return res.status(404).json({ error: 'Approval request not found' });
      }
      return res.json({ request: approvalRequest });
    }

    const pending = agentCore.AgentControls.getPendingApprovals(agentId);
    res.json({ requests: pending });
  } catch (error) {
    logger.error('Approval GET error', { component: 'approval' }, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/agent/approval — Create an approval request
router.post('/', async (req, res) => {
  const userId = req.userContext.userId || 'anonymous';
  const agentId = req.body.agentId || req.userContext.agentId || 'onpoint-stylist';

  const validationError = validateCreateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { actionType, amount, description, recipient } = req.body;

  try {
    await agentCore.AgentControls.initStore(agentId, userId);

    const approvalRequest = agentCore.AgentControls.createApprovalRequest({
      agentId,
      userId,
      actionType,
      amount,
      description,
      recipient,
      expiresInMinutes: 5,
    });

    res.status(201).json({ request: approvalRequest });
  } catch (error) {
    logger.error('Approval POST error', { component: 'approval' }, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/agent/approval — Approve or reject a request
router.patch('/', async (req, res) => {
  const userId = req.userContext.userId || 'anonymous';

  const validationError = validateUpdateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { id, action } = req.body;

  try {
    await agentCore.AgentControls.initStore('onpoint-stylist', userId);

    let success = false;
    if (action === 'approve') {
      success = agentCore.AgentControls.approveRequest(id, userId);
    } else {
      success = agentCore.AgentControls.rejectRequest(id, userId);
    }

    if (!success) {
      return res.status(400).json({ error: 'Failed to update approval request' });
    }

    const updated = agentCore.AgentControls.getApprovalRequest(id);
    res.json({ request: updated });
  } catch (error) {
    logger.error('Approval PATCH error', { component: 'approval' }, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
