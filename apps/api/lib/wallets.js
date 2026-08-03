/**
 * Fail-loud wallet resolver for the API money layer.
 *
 * Replaces the `agentCore.PLATFORM_WALLET || '0x5b33...'` silent-fallback
 * pattern that was baked into agent-checkout.js, agent-purchase.js, and
 * agent-registry.ts. If a money env var is ever unset, funds must NOT
 * silently route to a hardcoded address baked into source — the request
 * must fail with a clear error instead.
 *
 * Resolution order:
 *   1. Explicit env var (PLATFORM_WALLET_ADDRESS / AGENT_WALLET_ADDRESS)
 *   2. AGENT_WALLET_ADDRESS for the legacy platform-wallet alias
 *   3. In non-production only: a known dev address, with a loud warning.
 *   In production: throw — never silently default a money address.
 */

const logger = require('./logger');

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// Treat anything that is not explicitly development/test as production so
// a *missing* NODE_ENV (the footgun) fails closed, not open.
function isProdLike() {
  return (
    process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test'
  );
}

/**
 * Resolve a wallet address from env, falling back to the agent-core
 * constant. Throws in production-like environments if no valid address is
 * configured — money addresses never silently default.
 *
 * @param {string} envVar
 * @param {string|undefined} fallbackEnvVar — optional env alias
 * @param {string} label — human label for errors/logs
 * @returns {string} a valid 0x-prefixed address
 */
function resolveWallet(envVar, fallbackEnvVar, label) {
  const fromEnv = process.env[envVar];
  const candidate = fromEnv || (fallbackEnvVar ? process.env[fallbackEnvVar] : undefined);

  if (candidate && ADDRESS_RE.test(candidate)) {
    return candidate;
  }

  if (isProdLike()) {
    throw new Error(
      `${label} wallet is not configured. Set ${envVar} (or AGENT_WALLET_ADDRESS) ` +
        'to a valid 0x-prefixed address. Refusing to route funds to a default.',
    );
  }

  // Dev/test only — keep the loop walkable without env, but log loudly.
  logger.warn(
    `${label} wallet not configured — using dev fallback. Set ${envVar} for prod.`,
    { component: 'wallets' },
  );
  return '0x5b33E63440e95289207120B94da78CE22F9D24fB';
}

/** The agent wallet — signs transactions and receives platform fees. */
function getAgentWallet() {
  return resolveWallet('AGENT_WALLET_ADDRESS', null, 'Agent');
}

/** The platform wallet — legacy alias, now routed to the agent wallet. */
function getPlatformWallet() {
  return resolveWallet('PLATFORM_WALLET_ADDRESS', 'AGENT_WALLET_ADDRESS', 'Platform');
}

/**
 * Boot-time assertion — call from server startup so a misconfigured prod
 * deploy fails fast instead of serving requests that would silently route
 * funds. Logs (does not throw) in non-prod so local dev still boots.
 */
function assertWalletsConfigured() {
  // Resolve both money destinations at boot so a malformed platform alias
  // cannot wait until the first purchase request to fail.
  getAgentWallet();
  getPlatformWallet();
}

module.exports = {
  getAgentWallet,
  getPlatformWallet,
  assertWalletsConfigured,
  isProdLike,
};
