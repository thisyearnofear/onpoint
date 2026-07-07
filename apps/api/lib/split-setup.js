/**
 * 0xSplits SplitV2 Setup — non-custodial payout infrastructure.
 *
 * Deploys a per-curator SplitV2 contract on Celo that automatically
 * distributes incoming cUSD to the curator and platform proportionally.
 * This eliminates the custodial escrow pattern: the buyer pays the Split
 * contract directly, and the Split holds funds non-custodially until
 * `distribute` is called (permissionless — anyone can call it).
 *
 * Allocations (basis points, must sum to 1,000,000 for SplitV2):
 * - curator: (1 - revShare) * 1,000,000
 * - platform: revShare * 1,000,000
 *
 * The split address is stored in curator.commerce.splitAddress and used
 * as the `payTo` address in the x402 checkout flow.
 */

const { createPublicClient, createWalletClient, http } = require('viem');
const { celo } = require('viem/chains');
const agentCore = require('@repo/agent-core');
const logger = require('./logger');

// Lazy-load blockchain-client — it has native deps that may not be built
// in all environments. Only needed for split deployment/distribution.
let blockchainClient = null;
function getBlockchainClient() {
  if (!blockchainClient) {
    blockchainClient = require('@repo/blockchain-client');
  }
  return blockchainClient;
}

// SplitV2 uses totalAllocationPercent = 1,000,000 (not 10,000 like BPS)
const SPLIT_TOTAL_ALLOCATION = 1_000_000;

/**
 * Convert a revShare fraction (0..1, platform's cut) to SplitV2 recipients.
 * @param {string} curatorWallet - curator's payout address
 * @param {number} revShare - platform's fraction (e.g. 0.05 = 5%)
 * @returns {{ recipients: Array, distributorFeePercent: number }}
 */
function buildSplitRecipients(curatorWallet, revShare = 0.05) {
  const platformBps = Math.round(revShare * SPLIT_TOTAL_ALLOCATION);
  const curatorBps = SPLIT_TOTAL_ALLOCATION - platformBps;
  return {
    recipients: [
      { address: curatorWallet, percentAllocation: curatorBps / 10_000 }, // SDK expects percent (0-100)
      { address: agentCore.PLATFORM_WALLET, percentAllocation: platformBps / 10_000 },
    ],
    distributorFeePercent: 0, // no distributor fee — anyone can distribute for free
  };
}

/**
 * Deploy a SplitV2 contract for a curator on Celo.
 * Requires AGENT_PRIVATE_KEY for the deployment tx.
 *
 * @param {string} curatorWallet - curator's payout address (0x...)
 * @param {number} revShare - platform's fraction (0..1)
 * @returns {Promise<{ splitAddress: string, txHash: string }>}
 */
async function deployCuratorSplit(curatorWallet, revShare = 0.05) {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('AGENT_PRIVATE_KEY not configured — cannot deploy split');
  }

  const { createTransport } = agentCore;
  const transport = createTransport('celo');
  const publicClient = createPublicClient({ chain: celo, transport });
  const walletClient = createWalletClient({
    account: privateKey,
    chain: celo,
    transport,
  });

  const splitsClient = getBlockchainClient().createSplitsClient(
    celo.id,
    publicClient,
    walletClient,
  );

  const { recipients, distributorFeePercent } = buildSplitRecipients(curatorWallet, revShare);

  logger.info('Deploying SplitV2 for curator', {
    component: 'split-setup',
    curatorWallet,
    revShare,
    recipients: recipients.map((r) => ({ address: r.address, pct: r.percentAllocation })),
  });

  const result = await splitsClient.splitV2.createSplit({
    recipients,
    distributorFeePercent,
    ownerAddress: agentCore.PLATFORM_WALLET, // platform can update allocations if revShare changes
    creatorAddress: agentCore.PLATFORM_WALLET,
  });

  logger.info('SplitV2 deployed', {
    component: 'split-setup',
    splitAddress: result.splitAddress,
    txHash: result.event?.transactionHash,
  });

  return {
    splitAddress: result.splitAddress,
    txHash: result.event?.transactionHash || null,
  };
}

/**
 * Distribute accumulated cUSD in a SplitV2 to its recipients.
 * Permissionless — anyone can call this, but we use the agent wallet for gas.
 *
 * @param {string} splitAddress - the SplitV2 contract address
 * @param {string} tokenAddress - cUSD token address
 * @returns {Promise<{ txHash: string } | null>} null if no balance to distribute
 */
async function distributeSplit(splitAddress, tokenAddress) {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) return null;

  const transport = agentCore.createTransport('celo');
  const publicClient = createPublicClient({ chain: celo, transport });
  const walletClient = createWalletClient({
    account: privateKey,
    chain: celo,
    transport,
  });

  const splitsClient = getBlockchainClient().createSplitsClient(
    celo.id,
    publicClient,
    walletClient,
  );

  // Check if there's anything to distribute
  const balance = await splitsClient.splitV2.getSplitBalance({
    splitAddress,
    tokenAddress,
  });

  if (balance === 0n) return null;

  const result = await splitsClient.splitV2.distribute({
    splitAddress,
    tokenAddress,
  });

  logger.info('SplitV2 distributed', {
    component: 'split-setup',
    splitAddress,
    tokenAddress,
    txHash: result.event?.transactionHash,
  });

  return { txHash: result.event?.transactionHash || null };
}

/**
 * Get the undistributed cUSD balance in a SplitV2.
 * Useful for the curator ledger view.
 *
 * @param {string} splitAddress
 * @param {string} tokenAddress
 * @returns {Promise<bigint>}
 */
async function getSplitBalance(splitAddress, tokenAddress) {
  const transport = agentCore.createTransport('celo');
  const publicClient = createPublicClient({ chain: celo, transport });
  const splitsClient = getBlockchainClient().createSplitsClient(
    celo.id,
    publicClient,
    undefined,
  );

  return splitsClient.splitV2.getSplitBalance({
    splitAddress,
    tokenAddress,
  });
}

module.exports = {
  deployCuratorSplit,
  distributeSplit,
  getSplitBalance,
  buildSplitRecipients,
};
