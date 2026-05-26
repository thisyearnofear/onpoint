/**
 * Treasury Service — Agent Treasury Management
 *
 * Manages agent treasury, revenue streams, and compute expenses.
 *
 * Ported from apps/web/lib/services/treasury-service.ts
 *
 * Usage: require('../lib/treasury-service')
 */

const { parseEther } = require('viem');
const logger = require('./logger');

// State is backed by the persistent-state helpers in agent-core
const agentCore = require('@repo/agent-core');

// ============================================
// Redis Keys
// ============================================

const TREASURY_KEY = (agentId) => `treasury:${agentId}`;

// ============================================
// Compute Cost Table
// ============================================

const COMPUTE_COSTS = {
  gemini_live: parseEther('0.5'),    // 0.5 cUSD per session
  venice_vision: parseEther('0.1'),  // 0.1 cUSD per image
  openai_gpt4: parseEther('0.05'),   // 0.05 cUSD per request
  ipfs_pin: parseEther('0.01'),      // 0.01 cUSD per pin
  external_search: parseEther('0.1'), // 0.1 cUSD per search
};

// ============================================
// Treasury Management
// ============================================

/**
 * Get agent treasury
 * @param {string} agentId
 * @returns {Promise<object|null>}
 */
async function getAgentTreasury(agentId) {
  try {
    return await agentCore.redisGet(TREASURY_KEY(agentId));
  } catch {
    // Fallback: try persistent state
    return agentCore.readPersistentState(TREASURY_KEY(agentId), () => null);
  }
}

/**
 * Initialize agent treasury
 * @param {string} agentId
 * @param {number} chainId
 * @param {string} tokenAddress
 * @returns {Promise<object>}
 */
async function initializeTreasury(
  agentId,
  chainId = 42220,
  tokenAddress = '0x765DE816845861e75A25fCA122bb6898B8B1282a',
) {
  const treasury = {
    agentId,
    balance: '0',
    earned: '0',
    spent: '0',
    lastUpdated: Date.now(),
    chainId,
    tokenAddress,
  };

  try {
    await agentCore.redisSet(TREASURY_KEY(agentId), treasury);
  } catch {
    await agentCore.writePersistentState(TREASURY_KEY(agentId), treasury);
  }

  return treasury;
}

/**
 * Add revenue to treasury
 * @param {string} agentId
 * @param {string} source - 'tips' | 'commissions' | 'subscriptions' | 'api_fees'
 * @param {bigint} amount
 * @param {string} from - address
 * @param {string} [txHash]
 * @param {object} [metadata]
 * @returns {Promise<{treasury: object, revenue: object}>}
 */
async function addRevenue(agentId, source, amount, from, txHash, metadata) {
  let treasury = await getAgentTreasury(agentId);
  if (!treasury) {
    treasury = await initializeTreasury(agentId);
  }

  const currentBalance = BigInt(treasury.balance);
  const currentEarned = BigInt(treasury.earned);

  treasury.balance = (currentBalance + amount).toString();
  treasury.earned = (currentEarned + amount).toString();
  treasury.lastUpdated = Date.now();

  try {
    await agentCore.redisSet(TREASURY_KEY(agentId), treasury);
  } catch {
    await agentCore.writePersistentState(TREASURY_KEY(agentId), treasury);
  }

  const revenueId = `revenue_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const revenue = {
    id: revenueId,
    agentId,
    source,
    amount: amount.toString(),
    from,
    txHash,
    timestamp: Date.now(),
    metadata,
  };

  logger.info('Revenue added to treasury', {
    component: 'treasury',
    agentId,
    source,
    amount: amount.toString(),
  });

  return { treasury, revenue };
}

/**
 * Record expense from treasury
 * @param {string} agentId
 * @param {string} type - 'compute' | 'api_call' | 'gas' | 'storage' | 'other'
 * @param {bigint} amount
 * @param {string} description
 * @param {object} [metadata]
 * @returns {Promise<{treasury: object, expense: object}>}
 */
async function recordExpense(agentId, type, amount, description, metadata) {
  let treasury = await getAgentTreasury(agentId);
  if (!treasury) {
    treasury = await initializeTreasury(agentId);
  }

  const currentBalance = BigInt(treasury.balance);
  const currentSpent = BigInt(treasury.spent);

  if (currentBalance < amount) {
    throw new Error(
      `Insufficient treasury balance. Have: ${currentBalance.toString()}, Need: ${amount.toString()}`,
    );
  }

  treasury.balance = (currentBalance - amount).toString();
  treasury.spent = (currentSpent + amount).toString();
  treasury.lastUpdated = Date.now();

  try {
    await agentCore.redisSet(TREASURY_KEY(agentId), treasury);
  } catch {
    await agentCore.writePersistentState(TREASURY_KEY(agentId), treasury);
  }

  const expenseId = `expense_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const expense = {
    id: expenseId,
    agentId,
    type,
    amount: amount.toString(),
    description,
    timestamp: Date.now(),
    metadata,
  };

  logger.info('Expense recorded', {
    component: 'treasury',
    agentId,
    type,
    amount: amount.toString(),
    description,
  });

  return { treasury, expense };
}

/**
 * Check if agent can afford expense
 * @param {string} agentId
 * @param {bigint} amount
 * @returns {Promise<{canAfford: boolean, balance: bigint, shortfall?: bigint}>}
 */
async function canAffordExpense(agentId, amount) {
  const treasury = await getAgentTreasury(agentId);
  if (!treasury) {
    return { canAfford: false, balance: 0n, shortfall: amount };
  }

  const balance = BigInt(treasury.balance);
  if (balance >= amount) {
    return { canAfford: true, balance };
  }

  return { canAfford: false, balance, shortfall: amount - balance };
}

/**
 * Pay for compute from treasury
 * @param {string} agentId
 * @param {string} computeType
 * @param {string} description
 * @returns {Promise<{success: boolean, treasury?: object, error?: string}>}
 */
async function payForCompute(agentId, computeType, description) {
  const cost = COMPUTE_COSTS[computeType];

  if (!cost) {
    return { success: false, error: `Unknown compute type: ${computeType}` };
  }

  const affordCheck = await canAffordExpense(agentId, cost);
  if (!affordCheck.canAfford) {
    return {
      success: false,
      error: `Insufficient treasury balance. Need ${cost.toString()}, have ${affordCheck.balance.toString()}`,
    };
  }

  try {
    const { treasury } = await recordExpense(agentId, 'compute', cost, description, { computeType });
    return { success: true, treasury };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed',
    };
  }
}

/**
 * Auto-fund treasury from platform if balance low
 * @param {string} agentId
 * @param {bigint} [minimumBalance]
 * @param {bigint} [fundAmount]
 * @returns {Promise<{funded: boolean, treasury?: object}>}
 */
async function autoFundTreasury(
  agentId,
  minimumBalance = parseEther('10'),
  fundAmount = parseEther('50'),
) {
  const treasury = await getAgentTreasury(agentId);
  if (!treasury) {
    return { funded: false };
  }

  const balance = BigInt(treasury.balance);
  if (balance < minimumBalance) {
    await addRevenue(
      agentId,
      'subscriptions',
      fundAmount,
      '0x0000000000000000000000000000000000000000',
      undefined,
      { autoFunded: true, reason: 'Low balance' },
    );

    const updatedTreasury = await getAgentTreasury(agentId);

    logger.info('Treasury auto-funded', {
      component: 'treasury',
      agentId,
      amount: fundAmount.toString(),
    });

    return { funded: true, treasury: updatedTreasury || undefined };
  }

  return { funded: false, treasury };
}

/**
 * Get treasury statistics
 * @param {string} agentId
 * @returns {Promise<object>}
 */
async function getTreasuryStats(agentId) {
  const treasury = await getAgentTreasury(agentId);
  if (!treasury) {
    return { treasury: null, profitMargin: 0, burnRate: 0, runway: 0 };
  }

  const earned = BigInt(treasury.earned);
  const spent = BigInt(treasury.spent);
  const balance = BigInt(treasury.balance);

  const profitMargin = earned > 0n ? Number((earned - spent) * 100n / earned) : 0;
  const burnRate = Number(spent) / 1e18; // cUSD
  const runway = burnRate > 0 ? Number(balance) / 1e18 / burnRate : Infinity;

  return { treasury, profitMargin, burnRate, runway };
}

module.exports = {
  getAgentTreasury,
  initializeTreasury,
  addRevenue,
  recordExpense,
  canAffordExpense,
  payForCompute,
  autoFundTreasury,
  getTreasuryStats,
  COMPUTE_COSTS,
};
