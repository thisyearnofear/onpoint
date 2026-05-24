/**
 * API Key Validation Middleware
 *
 * Validates that incoming requests to AI routes contain a valid API key.
 * Uses VENICE_API_KEY in production; bypasses in development if no key is set.
 *
 * Accepts keys via:
 *   - Authorization: Bearer <key>
 *   - x-api-key: <key>
 */

function createApiKeyAuth({ required = true } = {}) {
  return function apiKeyAuthMiddleware(req, res, next) {
    const apiKey =
      req.headers["x-api-key"] ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    const configuredKey = process.env.VENICE_API_KEY;

    // No API key configured anywhere — fail closed in prod, open in dev
    if (!configuredKey) {
      if (process.env.NODE_ENV === "production" && required) {
        return res.status(500).json({ error: "API key not configured on server" });
      }
      return next();
    }

    // Check the provided key
    if (!apiKey) {
      return res.status(401).json({ error: "Missing API key. Use Authorization: Bearer <key> or x-api-key header." });
    }

    if (apiKey !== configuredKey) {
      return res.status(403).json({ error: "Invalid API key" });
    }

    next();
  };
}

module.exports = { createApiKeyAuth };
