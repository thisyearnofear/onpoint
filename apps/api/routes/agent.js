/**
 * Agent Routes Catch-All — /api/agent/*
 *
 * Phase 3 (complete): All agent endpoints run directly on Hetzner.
 * This catch-all router handles any remaining agent paths that aren't
 * matched by the specific route mounts in server.js.
 *
 * It maintains Vercel proxy capability as a fallback for future
 * edge-case routes, but all 16 agent routes are now ported directly.
 *
 * Auth: SERVICE_API_KEY (applied at server.js mount level)
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');

const VERCEL_DOMAIN = process.env.VERCEL_DOMAIN || '';

/**
 * Full list of ported agent routes — all handled directly on Hetzner.
 */
const PORTED_ROUTES = [
  'catalog', 'heartbeat', 'dashboard', 'wallet', 'identity',
  'suggestion', 'approval', 'style', 'tip', 'tip-agent',
  'fraud', 'mint', 'purchase', 'checkout', 'escrow',
  'treasury', 'missions', 'schedule-event',
];

/**
 * Forward to Vercel as a fallback proxy.
 */
async function forwardToVercel(req, path, options = {}) {
  const { method = req.method, body, queryString = '' } = options;

  if (!VERCEL_DOMAIN) {
    return {
      forwarded: false,
      status: 503,
      body: {
        error: 'VERCEL_DOMAIN not configured',
        note: 'Set VERCEL_DOMAIN to enable fallback proxy',
      },
    };
  }

  const url = `${VERCEL_DOMAIN}/api/agent/${path}${queryString}`;

  try {
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SERVICE_API_KEY ? { 'x-service-key': process.env.SERVICE_API_KEY } : {}),
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
      },
      signal: AbortSignal.timeout(25000),
    };

    if (body) fetchOptions.body = JSON.stringify(body);

    const response = await fetch(url, fetchOptions);
    const responseBody = await response.json().catch(() => ({ error: 'Failed to parse Vercel response' }));

    return { forwarded: true, status: response.status, body: responseBody };
  } catch (err) {
    logger.warn('Vercel proxy failed', {
      component: 'agent-proxy',
      path,
      method,
      error: err.message,
    });

    return {
      forwarded: false,
      status: 502,
      body: { error: 'Agent endpoint unavailable', detail: err.message, upstream: VERCEL_DOMAIN },
    };
  }
}

// ── Catch-all for unmatched agent routes ──

router.all('/:route', async (req, res) => {
  const route = req.params.route;
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

  // If it's a ported route that shouldn't reach here, log it
  if (PORTED_ROUTES.includes(route)) {
    logger.warn('Ported route reached catch-all (mount order issue)', {
      component: 'agent-catchall',
      route,
    });
    return res.status(404).json({
      error: `Route /api/agent/${route} should be handled by direct mount`,
    });
  }

  // Try Vercel proxy fallback
  if (VERCEL_DOMAIN) {
    const result = await forwardToVercel(req, route, {
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
      queryString: qs,
    });
    return res.status(result.status).json(result.body);
  }

  // Fallback: list all ported routes
  res.json({
    status: 'ok',
    message: `Route /api/agent/${route} is not recognized`,
    portedRoutes: PORTED_ROUTES,
  });
});

module.exports = router;
