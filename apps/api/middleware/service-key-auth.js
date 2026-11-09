/**
 * Service-to-Service API Key Auth Middleware
 *
 * Validates internal service requests against SERVICE_API_KEY (separate from
 * the external VENICE_API_KEY). Accepts the key via:
 *   - x-service-key: <key>
 *   - Authorization: Bearer <key>
 *
 * Fails closed in any non-dev environment when no key is configured, and
 * compares keys in constant time to avoid timing side channels.
 */

const crypto = require('crypto');

function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  // timingSafeEqual throws on length mismatch; guard first. The length check
  // itself is not secret-sensitive (key length is not a credential).
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

function createServiceApiKeyAuth() {
  // Anything not explicitly development/test is prod-like, so a missing
  // NODE_ENV fails closed rather than silently bypassing auth.
  const isProdLike = () =>
    process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test';

  return function serviceAuth(req, res, next) {
    const serviceKey = process.env.SERVICE_API_KEY;

    if (!serviceKey) {
      if (isProdLike()) {
        return res.status(500).json({ error: 'SERVICE_API_KEY not configured on server' });
      }
      return next();
    }

    const provided =
      req.headers['x-service-key'] ??
      req.headers['authorization']?.replace('Bearer ', '')?.trim() ??
      null;

    if (!provided) {
      return res.status(401).json({
        error: 'Missing service key. Use x-service-key header or Authorization: Bearer <key>.',
      });
    }

    if (!timingSafeStringEqual(provided, serviceKey)) {
      return res.status(403).json({ error: 'Invalid service key' });
    }

    next();
  };
}

module.exports = { createServiceApiKeyAuth, timingSafeStringEqual };
