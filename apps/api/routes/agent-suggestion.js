/**
 * Agent Suggestion Route — /api/agent/suggestion
 *
 * Manages agent suggestions with quick-accept for small amounts.
 * Supports autonomous execution for amounts below threshold.
 * Creates Verifiable Agent Logs (IPFS/Filecoin) for audit trails.
 *
 * Ported from apps/web/app/api/agent/suggestion/route.ts
 *
 * Auth: SERVICE_API_KEY + forwarded user context
 */

const express = require('express');
const router = express.Router();
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { forwardedUser, requireUserField } = require('../middleware/forwarded-user');

// ── Suggestion schema validation ──

const VALID_ACTION_TYPES = [
  'tip', 'purchase', 'mint', 'premium',
  'agent_to_agent', 'external_search',
];

const VALID_UPDATE_ACTIONS = ['accept', 'reject'];

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

// All suggestion routes need user context
router.use(forwardedUser);

// GET /api/agent/suggestion — List pending suggestions or get one by ID
router.get('/', async (req, res) => {
  const agentId = req.query.agentId || req.userContext.agentId || 'onpoint-stylist';
  const userId = req.userContext.userId || 'anonymous';
  const suggestionId = req.query.id;

  try {
    await agentCore.AgentControls.initStore(agentId, userId);

    if (suggestionId) {
      const suggestion = agentCore.AgentControls.getSuggestion(suggestionId);
      if (!suggestion) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }
      return res.json({ suggestion });
    }

    const pending = agentCore.AgentControls.getPendingSuggestions(agentId);
    res.json({ suggestions: pending });
  } catch (error) {
    logger.error('Suggestion GET error', { component: 'suggestion' }, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/agent/suggestion — Create a suggestion (may auto-execute)
router.post('/', async (req, res) => {
  const userId = req.userContext.userId || 'anonymous';
  const agentId = req.body.agentId || req.userContext.agentId || 'onpoint-stylist';

  const validationError = validateCreateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { actionType, amount, description, recipient, isSearching, liveUrl } = req.body;

  try {
    await agentCore.AgentControls.initStore(agentId, userId);

    // Use suggestAction which handles autonomy threshold
    const result = agentCore.AgentControls.suggestAction({
      agentId,
      userId,
      actionType,
      amount,
      description,
      recipient,
      metadata: { isSearching, liveUrl },
    });

    // Create Verifiable Agent Log (IPFS/Filecoin) for audit trail
    let verifiableLogCid = null;
    try {
      // If the upstream analyze call ran on 0G Compute and the agent
      // layer stamped the TEE proof on the suggestion metadata, lift
      // it into the receipt's attestation block. Two attestations on
      // a single IPFS-pinned receipt — our signer commits to the
      // action, the TEE provider commits to the inference. See
      // docs/adr/0006-0g-compute-african-fashion.md.
      const teeProof = result.suggestion?.metadata?.tee;
      const { cid } = await agentCore.VerifiableAgentService.createVerifiableLog(
        result.suggestion,
        userId,
        undefined,
        teeProof
          ? {
              tee: {
                provider: teeProof.provider,
                requestId: teeProof.requestId,
                mode: teeProof.mode,
                teeType: "TDX",
                verifier: "dstack",
                billing: teeProof.billing,
              },
            }
          : {},
      );
      verifiableLogCid = cid;

      // Update suggestion with verifiability info
      result.suggestion.verifiableLogCid = cid;
      await agentCore.persistSuggestion(result.suggestion, userId);
    } catch (err) {
      logger.warn('Failed to create verifiable log', { component: 'suggestion' }, err);
    }

    // Auto-execute if applicable
    let executionResult = null;
    if (result.autoExecuted && result.suggestion.actionType !== 'external_search') {
      try {
        executionResult = await agentCore.executeSuggestion({
          agentId,
          userId,
          userAddress: userId || recipient || '',
          actionType: result.suggestion.actionType,
          amount: result.suggestion.amount,
          description: result.suggestion.description,
          recipient: result.suggestion.recipient,
          metadata: result.suggestion.metadata,
          suggestionId: result.suggestion.id,
        });

        if (executionResult.success) {
          agentCore.AgentControls.markSuggestionExecuted(
            result.suggestion.id,
            userId,
          );
        }
      } catch (execErr) {
        logger.error('Auto-execution failed', { component: 'suggestion' }, execErr);
      }
    }

    const response = {
      suggestion: result.suggestion,
      autoExecuted: result.autoExecuted,
      executed: executionResult
        ? {
            success: executionResult.success,
            txHash: executionResult.txHash,
            explorerUrl: executionResult.explorerUrl,
            error: executionResult.error || null,
          }
        : undefined,
      message: result.autoExecuted
        ? executionResult?.success
          ? 'Action auto-approved and executed onchain'
          : 'Action auto-approved but execution failed'
        : 'Suggestion created - awaiting user approval',
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Suggestion POST error', { component: 'suggestion' }, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/agent/suggestion — Accept or reject a suggestion
router.patch('/', async (req, res) => {
  const userId = req.userContext.userId || 'anonymous';

  const validationError = validateUpdateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { id, action } = req.body;

  try {
    // Load suggestion from store if not in memory
    let suggestion = agentCore.AgentControls.getSuggestion(id);
    if (!suggestion) {
      const stored = await agentCore.loadSuggestionFromStore(id);
      if (stored) {
        await agentCore.AgentControls.initStore(stored.agentId, userId);
      }
    }

    let success = false;
    let executionResult = null;

    if (action === 'accept') {
      success = agentCore.AgentControls.acceptSuggestion(id, userId);

      if (success) {
        const updatedSuggestion = agentCore.AgentControls.getSuggestion(id);
        if (updatedSuggestion && updatedSuggestion.actionType !== 'external_search') {
          try {
            executionResult = await agentCore.executeSuggestion({
              agentId: updatedSuggestion.agentId,
              userId,
              userAddress: userId || updatedSuggestion.recipient || '',
              actionType: updatedSuggestion.actionType,
              amount: updatedSuggestion.amount,
              description: updatedSuggestion.description,
              recipient: updatedSuggestion.recipient,
              metadata: updatedSuggestion.metadata,
              suggestionId: id,
            });

            if (executionResult.success) {
              agentCore.AgentControls.markSuggestionExecuted(id, userId);
            }
          } catch (execErr) {
            logger.error('Autonomous execution failed', { component: 'suggestion' }, execErr);
          }
        }
      }
    } else {
      success = agentCore.AgentControls.rejectSuggestion(id, userId);
    }

    if (!success) {
      return res.status(400).json({ error: 'Failed to update suggestion' });
    }

    const updated = agentCore.AgentControls.getSuggestion(id);

    res.json({
      suggestion: updated,
      executed: executionResult
        ? {
            success: executionResult.success,
            txHash: executionResult.txHash,
            explorerUrl: executionResult.explorerUrl,
            error: executionResult.error || null,
          }
        : undefined,
    });
  } catch (error) {
    logger.error('Suggestion PATCH error', { component: 'suggestion' }, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
