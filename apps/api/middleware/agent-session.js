/**
 * Require a verified wallet session (issued by /api/auth/verify).
 *
 * Accepts the token via `Authorization: Bearer <token>` or `x-agent-session`.
 * A bare x-agent-address header is NOT an identity proof — it remains usable
 * only for public reads and attribution, never for creator-scoped writes.
 */

const { verifySessionToken } = require('../lib/agent-session');

const SESSION_HINT =
  'POST /api/auth/challenge {address}, sign the returned message with your wallet, ' +
  'POST /api/auth/verify {address, signature}, then send Authorization: Bearer <token>.';

function extractSessionToken(req) {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim() || null;
  }
  const header = req.headers['x-agent-session'];
  return typeof header === 'string' && header ? header : null;
}

function requireAgentSession(req, res, next) {
  const token = extractSessionToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Wallet session required. A bare x-agent-address header is no longer accepted for writes.',
      code: 'SESSION_REQUIRED',
      hint: SESSION_HINT,
    });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Invalid or expired wallet session',
      code: 'SESSION_INVALID',
      hint: SESSION_HINT,
    });
  }

  const claimed = req.headers['x-agent-address'];
  if (typeof claimed === 'string' && claimed && claimed.toLowerCase() !== payload.sub) {
    return res.status(403).json({
      error: 'x-agent-address does not match the authenticated session wallet',
      code: 'SESSION_ADDRESS_MISMATCH',
    });
  }

  req.agentSession = payload;
  next();
}

module.exports = { requireAgentSession, extractSessionToken };