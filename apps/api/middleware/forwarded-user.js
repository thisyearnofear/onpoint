/**
 * Forwarded User Context Middleware
 *
 * Vercel authenticates users (SIWE, Auth0), then forwards requests to Hetzner
 * with service-level auth (SERVICE_API_KEY) and user context as headers.
 *
 * This middleware extracts those headers and attaches them to `req.userContext`.
 *
 * Architecture (ADR 0001):
 *   Vercel = identity + presentation
 *   Hetzner = agent state + execution (trusts Vercel's auth)
 */

/**
 * Extract user context from forwarded headers.
 * Only call this after SERVICE_API_KEY auth has passed.
 */
function forwardedUser(req, res, next) {
  req.userContext = {
    userId: req.headers['x-user-id'] || null,
    agentId: req.headers['x-agent-id'] || 'onpoint-stylist',
    userAddress: req.headers['x-user-address'] || null,
    walletAddress: req.headers['x-wallet-address'] || null,
    source: 'forwarded',
  };

  next();
}

/**
 * Require a specific user context field.
 * Returns 401 if the field is missing.
 */
function requireUserField(field) {
  return (req, res, next) => {
    if (!req.userContext) {
      return res.status(500).json({ error: 'User context middleware not configured' });
    }
    if (!req.userContext[field]) {
      return res.status(401).json({
        error: `Missing required user context: ${field}`,
        hint: 'Vercel must forward x-user-id header',
      });
    }
    next();
  };
}

module.exports = { forwardedUser, requireUserField };
