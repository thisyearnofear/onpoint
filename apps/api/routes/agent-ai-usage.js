/**
 * Agent AI usage — GET /api/agent/ai-usage
 *
 * Self-serve read of the caller's Otari (Mozilla AI) key usage and
 * enforced budgets. Any Otari key can read its own spend via
 * /key/usage/summary + /key/budget — no master key required.
 *
 * Auth story for agents:
 *   - x-otari-key header: the agent's own Otari key (otk_…) — its
 *     spend is metered and budget-capped in its own workspace.
 *   - no header: falls back to the workspace OTARI_API_KEY so the
 *     route also works as an ops dashboard probe.
 *
 * This is the read side of OnPoint's per-agent metered-key design:
 * agent calls made with x-otari-key are attributed to that key in the
 * Otari Activity view, and this endpoint is how the agent reconciles
 * what its AI calls actually cost — the same ledger the x402/cUSD
 * rails use for commerce spend.
 *
 * Mounted in server.js under /api/agent/ai-usage.
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');

const OTARI_BASE_URL = process.env.OTARI_BASE_URL || 'https://api.otari.ai/api/v1';

async function otariGet(apiKey, path) {
  const response = await fetch(`${OTARI_BASE_URL.replace(/\/$/, '')}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    const err = new Error(`Otari ${path} error ${response.status}: ${errBody.slice(0, 200)}`);
    err.status = response.status === 401 ? 401 : 502;
    throw err;
  }
  return response.json();
}

router.get('/', async (req, res) => {
  const agentKey = req.headers['x-otari-key'];
  const workspaceKey = process.env.OTARI_API_KEY;
  const keySource = agentKey ? 'agent' : workspaceKey ? 'workspace' : null;
  const apiKey = agentKey || workspaceKey;

  if (!apiKey) {
    return res.status(503).json({
      error: 'No Otari key available. Send x-otari-key or configure OTARI_API_KEY.',
      code: 'OTARI_NOT_CONFIGURED',
    });
  }
  if (agentKey && !String(agentKey).startsWith('otk_')) {
    return res.status(400).json({
      error: 'x-otari-key must be an Otari workspace key (otk_…).',
      code: 'OTARI_KEY_MALFORMED',
    });
  }

  try {
    const params = new URLSearchParams();
    for (const name of ['start_date', 'end_date', 'bucket']) {
      if (req.query[name]) params.set(name, String(req.query[name]));
    }
    const qs = params.toString() ? `?${params}` : '';

    const [usage, budget] = await Promise.all([
      otariGet(apiKey, `/key/usage/summary${qs}`),
      otariGet(apiKey, '/key/budget'),
    ]);

    return res.json({
      success: true,
      provider: 'otari',
      keySource,
      usage,
      budget,
      hint:
        'Send x-otari-key on OnPoint agent calls to meter AI spend to your own ' +
        'Otari workspace. Provision per-agent keys with budgets via the Otari ' +
        'dashboard or OTARI_ADMIN_KEY provisioning (scripts/otari-agent-keys.mjs).',
    });
  } catch (error) {
    logger.warn?.('agent ai-usage read failed', {
      component: 'agent-ai-usage',
      error: error.message,
    });
    return res.status(error.status || 502).json({
      error: error.message,
      code: 'OTARI_USAGE_READ_FAILED',
    });
  }
});

module.exports = router;
