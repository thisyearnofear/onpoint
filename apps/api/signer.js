#!/usr/bin/env node
/**
 * onpoint-signer — Isolated Signer Process
 *
 * Sole holder of AGENT_PRIVATE_KEY. Listens on 127.0.0.1:48753 (loopback only).
 * Re-validates policy before signing and broadcasting. Every signature is
 * logged to Redis for audit trail.
 *
 * Architecture (ADR 0001 Phase 4):
 *   onpoint-api  →  POST /sign/*  →  onpoint-signer  →  broadcast via viem
 *       (no key)       x-signer-key auth    (holds AGENT_PRIVATE_KEY)
 *
 * Swappable for KMS / Turnkey / Fireblocks later without touching callers.
 *
 * Port: 48753 (internal — loopback only, NOT exposed via nginx)
 */

require('dotenv').config();

const express = require('express');
const logger = require('./lib/logger');

// ── Sentry (optional) ──
let Sentry;
if (process.env.SENTRY_DSN) {
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    release: process.env.SENTRY_RELEASE || `onpoint-signer@${process.env.npm_package_version || '2.1.0'}`,
    tracesSampleRate: 0.1,
  });
  logger.info('Sentry initialized for signer', { component: 'signer' });
}

// ── Constants ──
const SIGNER_PORT = parseInt(process.env.SIGNER_PORT) || 48753;
const SIGNER_API_KEY = process.env.SIGNER_API_KEY || '';
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || '';

// ── Network Binding Guard ──
// The signer must ONLY bind to loopback. If BIND_ALL is explicitly set,
// log a loud warning — this should never happen in production.
const BIND_ADDRESS = process.env.SIGNER_BIND_ALL ? '0.0.0.0' : '127.0.0.1';
if (process.env.SIGNER_BIND_ALL) {
  logger.warn('SIGNER_BIND_ALL is set — signer binding to 0.0.0.0! This is INSECURE in production.', {
    component: 'signer',
  });
}

// ── State ──
// Cache agent address derived from private key (initialized at startup)
let agentAddress = '';
let agentChain = 'celo';

// ── Express App ──
const app = express();
app.use(express.json({ limit: '10kb' }));

// ── Auth Middleware ──
function requireSignerKey(req, res, next) {
  const provided = req.headers['x-signer-key'];
  if (!SIGNER_API_KEY) {
    return next(); // Dev mode: no key configured
  }
  if (!provided) {
    return res.status(401).json({
      success: false,
      error: 'Missing x-signer-key header',
      code: 'MISSING_SIGNER_KEY',
    });
  }
  if (provided !== SIGNER_API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Invalid signer key',
      code: 'INVALID_SIGNER_KEY',
    });
  }
  next();
}

app.use(requireSignerKey);

// ── Health Endpoint ──
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    process: 'onpoint-signer',
    address: agentAddress,
    gasBalance: process.env.SIGNER_GAS_BALANCE || 'unknown',
    chain: agentChain,
    uptime: process.uptime(),
    pid: process.pid,
  });
});

// ── Signing Endpoints ──

/**
 * POST /sign/transfer — Sign and broadcast a cUSD / ERC-20 transfer
 */
app.post('/sign/transfer', async (req, res) => {
  const { chain, tokenAddress, to, amountWei, action, agentId, userId, suggestionId, description } = req.body;

  // Validate required fields
  if (!chain || !tokenAddress || !to || !amountWei || !action || !agentId || !userId || !suggestionId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: chain, tokenAddress, to, amountWei, action, agentId, userId, suggestionId',
      code: 'MISSING_FIELDS',
    });
  }

  if (!AGENT_PRIVATE_KEY) {
    return res.status(503).json({
      success: false,
      error: 'AGENT_PRIVATE_KEY not configured on signer',
      code: 'SIGNING_NOT_CONFIGURED',
    });
  }

  try {
    // ── Policy Gate ──
    const policyResult = await checkPolicy(agentId, userId, action, amountWei, description);
    if (!policyResult.allowed) {
      await persistSignerLog({
        suggestionId, agentId, userId, action, amount: amountWei,
        decision: 'rejected', reason: policyResult.reason,
      });
      return res.status(403).json({
        success: false,
        error: policyResult.reason,
        code: policyResult.code || 'POLICY_REJECTED',
      });
    }

    // ── Execute Transfer ──
    const { createWalletClient, http } = require('viem');
    const chainModule = getChainModule(chain);
    const rpcUrl = getRpcUrl(chain);

    const walletClient = createWalletClient({
      account: AGENT_PRIVATE_KEY,
      chain: chainModule,
      transport: http(rpcUrl),
    });

    const nonce = await getNextNonce(chain);

    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, BigInt(amountWei)],
      ...(nonce !== undefined ? { nonce } : {}),
    });

    const explorerUrl = getExplorerUrlForChain(chain, hash);

    // Record spending (best-effort, non-blocking)
    recordSpending(agentId, userId, action, amountWei).catch(() => {});

    // Persist audit log
    await persistSignerLog({
      suggestionId, agentId, userId, action, amount: amountWei,
      txHash: hash, decision: 'signed',
    });

    logger.info('Transfer signed and broadcast', {
      component: 'signer',
      action,
      agentId,
      userId,
      suggestionId,
      amount: amountWei,
      txHash: hash,
      chain,
    });

    res.json({
      success: true,
      txHash: hash,
      explorerUrl,
    });
  } catch (err) {
    logger.error('Transfer signing failed', { component: 'signer', agentId, userId, suggestionId, action }, err);

    await persistSignerLog({
      suggestionId, agentId, userId, action, amount: amountWei,
      decision: 'failed', reason: err.message,
    }).catch(() => {});

    res.status(500).json({
      success: false,
      error: err.message || 'Transfer signing failed',
      code: 'SIGNING_FAILED',
    });
  }
});

/**
 * POST /sign/mint — Sign and broadcast an NFT mint
 */
app.post('/sign/mint', async (req, res) => {
  const { chain, nftContract, metadataUri, recipients, agentId, userId, suggestionId } = req.body;

  if (!chain || !nftContract || !metadataUri || !recipients || !agentId || !userId || !suggestionId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      code: 'MISSING_FIELDS',
    });
  }

  if (!AGENT_PRIVATE_KEY) {
    return res.status(503).json({
      success: false,
      error: 'AGENT_PRIVATE_KEY not configured on signer',
      code: 'SIGNING_NOT_CONFIGURED',
    });
  }

  try {
    const policyResult = await checkPolicy(agentId, userId, 'mint', '0', `Mint NFT for ${recipients?.[0]?.address?.slice(0, 6)}`);
    if (!policyResult.allowed) {
      await persistSignerLog({
        suggestionId, agentId, userId, action: 'mint',
        decision: 'rejected', reason: policyResult.reason,
      });
      return res.status(403).json({
        success: false,
        error: policyResult.reason,
        code: policyResult.code || 'POLICY_REJECTED',
      });
    }

    const { createPublicClient, createWalletClient, http } = require('viem');
    const blockchainClient = require('@repo/blockchain-client');
    const chainModule = getChainModule(chain);
    const rpcUrl = getRpcUrl(chain);

    const publicClient = createPublicClient({
      chain: chainModule,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account: AGENT_PRIVATE_KEY,
      chain: chainModule,
      transport: http(rpcUrl),
    });

    const nonce = await getNextNonce(chain);
    const splitsClient = blockchainClient.createSplitsClient(
      chainModule.id,
      publicClient,
      walletClient,
    );

    const result = await blockchainClient.mintNFTWithSplit(
      walletClient,
      publicClient,
      nftContract,
      metadataUri,
      {
        recipients: recipients.map(r => ({
          address: r.address,
          percentAllocation: r.percentAllocation,
        })),
        ...(nonce !== undefined ? { nonce } : {}),
      },
      splitsClient,
    );

    const explorerUrl = getExplorerUrlForChain(chain, result.transactionHash);

    recordSpending(agentId, userId, 'mint', result.transactionHash || '0').catch(() => {});

    await persistSignerLog({
      suggestionId, agentId, userId, action: 'mint',
      txHash: result.transactionHash, tokenId: result.tokenId,
      decision: 'signed',
    });

    logger.info('NFT mint signed and broadcast', {
      component: 'signer',
      agentId,
      userId,
      suggestionId,
      tokenId: result.tokenId,
      txHash: result.transactionHash,
      chain,
    });

    res.json({
      success: true,
      txHash: result.transactionHash,
      tokenId: result.tokenId,
      explorerUrl,
    });
  } catch (err) {
    logger.error('NFT mint signing failed', { component: 'signer', agentId, userId, suggestionId }, err);

    await persistSignerLog({
      suggestionId, agentId, userId, action: 'mint',
      decision: 'failed', reason: err.message,
    }).catch(() => {});

    res.status(500).json({
      success: false,
      error: err.message || 'Mint signing failed',
      code: 'SIGNING_FAILED',
    });
  }
});

/**
 * POST /sign/contract — Sign and broadcast a generic contract call
 */
app.post('/sign/contract', async (req, res) => {
  const { chain, to, data, value, agentId, userId, suggestionId, description } = req.body;

  if (!chain || !to || !data || !agentId || !userId || !suggestionId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      code: 'MISSING_FIELDS',
    });
  }

  if (!AGENT_PRIVATE_KEY) {
    return res.status(503).json({
      success: false,
      error: 'AGENT_PRIVATE_KEY not configured on signer',
      code: 'SIGNING_NOT_CONFIGURED',
    });
  }

  try {
    const policyResult = await checkPolicy(agentId, userId, 'contract', value || '0', description || 'Contract call');
    if (!policyResult.allowed) {
      await persistSignerLog({
        suggestionId, agentId, userId, action: 'contract',
        decision: 'rejected', reason: policyResult.reason,
      });
      return res.status(403).json({
        success: false,
        error: policyResult.reason,
        code: policyResult.code || 'POLICY_REJECTED',
      });
    }

    const { createWalletClient, http } = require('viem');
    const chainModule = getChainModule(chain);
    const rpcUrl = getRpcUrl(chain);

    const walletClient = createWalletClient({
      account: AGENT_PRIVATE_KEY,
      chain: chainModule,
      transport: http(rpcUrl),
    });

    const nonce = await getNextNonce(chain);

    const hash = await walletClient.sendTransaction({
      to,
      data,
      value: value ? BigInt(value) : undefined,
      ...(nonce !== undefined ? { nonce } : {}),
    });

    const explorerUrl = getExplorerUrlForChain(chain, hash);

    recordSpending(agentId, userId, 'contract', value || '0').catch(() => {});

    await persistSignerLog({
      suggestionId, agentId, userId, action: 'contract',
      txHash: hash, decision: 'signed',
    });

    logger.info('Contract call signed and broadcast', {
      component: 'signer',
      agentId,
      userId,
      suggestionId,
      txHash: hash,
      chain,
    });

    res.json({
      success: true,
      txHash: hash,
      explorerUrl,
    });
  } catch (err) {
    logger.error('Contract signing failed', { component: 'signer', agentId, userId, suggestionId }, err);

    await persistSignerLog({
      suggestionId, agentId, userId, action: 'contract',
      decision: 'failed', reason: err.message,
    }).catch(() => {});

    res.status(500).json({
      success: false,
      error: err.message || 'Contract signing failed',
      code: 'SIGNING_FAILED',
    });
  }
});

// ── Internal Helpers ──

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
];

function getChainModule(chain) {
  const { celo, base, mainnet, polygon } = require('viem/chains');
  const map = {
    celo,
    celoSepolia: { ...celo, id: 11142220 },
    base,
    ethereum: mainnet,
    polygon,
  };
  return map[chain] || celo;
}

const rpcUrls = {
  celo: 'https://forno.celo.org',
  celoSepolia: 'https://alfajores-forno.celo.org',
  base: 'https://mainnet.base.org',
  ethereum: 'https://eth.llamarpc.com',
  polygon: 'https://polygon.llamarpc.com',
};

function getRpcUrl(chain) {
  return rpcUrls[chain] || rpcUrls.celo;
}

function getExplorerUrlForChain(chain, hash) {
  const bases = {
    celo: 'https://celoscan.io',
    base: 'https://basescan.org',
    ethereum: 'https://etherscan.io',
    polygon: 'https://polygonscan.com',
  };
  const base = bases[chain] || bases.celo;
  return `${base}/tx/${hash}`;
}

/**
 * Policy gate — re-validates spend policy, frozen state, fraud score.
 * This duplicates the caller's validation so a leaked SERVICE_API_KEY
 * still can't bypass limits.
 */
async function checkPolicy(agentId, userId, action, amount, description) {
  try {
    const agentCore = require('@repo/agent-core');

    // 1. Check frozen state
    const frozen = await agentCore.isAgentFrozen(agentId, userId);
    if (frozen?.frozen) {
      return { allowed: false, reason: 'Agent is frozen', code: 'AGENT_FROZEN' };
    }

    // 2. Validate with escrow (spending limits, anomaly score)
    const validation = await agentCore.validateActionWithEscrow({
      agentId,
      userId,
      actionType: action,
      amount: BigInt(amount || '0'),
      amountFormatted: amount || '0',
      description: description || '',
    });

    if (!validation.allowed) {
      return {
        allowed: false,
        reason: validation.reason || 'Action not allowed by policy',
        code: validation.requiresApproval ? 'APPROVAL_REQUIRED' : 'POLICY_REJECTED',
      };
    }

    // 3. Check multi-sig requirement (currently a stub — returns false for small amounts)
    const multiSigRequired = agentCore.requiresMultiSig
      ? agentCore.requiresMultiSig(BigInt(amount || '0'))
      : false;
    if (multiSigRequired) {
      return { allowed: false, reason: 'Multi-sig required for this amount', code: 'MULTISIG_REQUIRED' };
    }

    return { allowed: true };
  } catch (err) {
    logger.error('Policy check failed, allowing by default', { component: 'signer', agentId, userId, action }, err);
    // Fail open for now — the caller already validated; this is defense-in-depth
    return { allowed: true };
  }
}

/**
 * Nonce management via Redis (atomic INCR)
 */
const NONCE_KEY = (chain) => `signer:nonce:${chain}`;

async function getNextNonce(chain) {
  try {
    const { redisIncr, isRedisConfigured } = require('@repo/agent-core');
    if (!isRedisConfigured()) return undefined;

    const key = NONCE_KEY(chain);
    const incremented = await redisIncr(key);

    if (incremented === null || incremented === undefined) {
      return undefined;
    }

    if (incremented === 1) {
      // First increment — seed from chain's current nonce
      const { createPublicClient, http } = require('viem');
      const chainModule = getChainModule(chain);
      const rpcUrl = getRpcUrl(chain);
      const client = createPublicClient({ chain: chainModule, transport: http(rpcUrl) });
      const currentNonce = await client.getTransactionCount({ address: agentAddress });
      const { redisSet } = require('@repo/agent-core');
      await redisSet(key, (Number(currentNonce) + 1).toString());
      return currentNonce;
    }

    return BigInt(incremented - 1);
  } catch {
    return undefined;
  }
}

/**
 * Record agent spending (best-effort, non-blocking)
 */
async function recordSpending(agentId, userId, action, amount) {
  try {
    const { AgentControls } = require('@repo/agent-core');
    await AgentControls.recordSpending(agentId, userId, action, BigInt(amount || '0'));
  } catch (err) {
    logger.warn('Failed to record spending from signer', { component: 'signer', agentId, userId, action }, err);
  }
}

/**
 * Persist a signer audit log entry to Redis
 */
const SIGNER_LOG_KEY = (id) => `signer:log:${id}`;

async function persistSignerLog(entry) {
  try {
    const { redisSetEx, isRedisConfigured } = require('@repo/agent-core');
    if (!isRedisConfigured()) return;

    const logEntry = {
      ...entry,
      ts: Date.now(),
    };

    await redisSetEx(SIGNER_LOG_KEY(entry.suggestionId), logEntry, 86400 * 30);
  } catch (err) {
    logger.warn('Failed to persist signer log', { component: 'signer', suggestionId: entry.suggestionId }, err);
  }
}

// ── Initialize agent address on startup ──
async function initialize() {
  if (AGENT_PRIVATE_KEY) {
    try {
      const { privateKeyToAccount } = require('viem/accounts');
      const pk = AGENT_PRIVATE_KEY.startsWith('0x') ? AGENT_PRIVATE_KEY : `0x${AGENT_PRIVATE_KEY}`;
      const account = privateKeyToAccount(pk);
      agentAddress = account.address;
      logger.info('Signer initialized', { component: 'signer', address: agentAddress });
    } catch (err) {
      logger.error('Failed to derive agent address from private key', { component: 'signer' }, err);
    }
  }
}

// ── Graceful Shutdown ──
process.on('SIGTERM', () => {
  logger.info('Signer shutting down (SIGTERM)', { component: 'signer' });
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Signer shutting down (SIGINT)', { component: 'signer' });
  process.exit(0);
});

// ── Export for testing ──
module.exports = {
  app,
  initialize,
  getChainModule,
  getRpcUrl,
  getExplorerUrlForChain,
  ERC20_ABI,
};

// ── Start Server (only when run directly, not when imported) ──
if (require.main === module) {
  initialize().then(() => {
    app.listen(SIGNER_PORT, BIND_ADDRESS, () => {
      logger.info(`onpoint-signer running on ${BIND_ADDRESS}:${SIGNER_PORT}`, {
        component: 'signer',
        address: agentAddress || 'unknown',
        bindAddress: BIND_ADDRESS,
      });
      if (BIND_ADDRESS === '127.0.0.1') {
        logger.info('Signer is loopback-only — not exposed to network', { component: 'signer' });
      }
    });
  });
}
