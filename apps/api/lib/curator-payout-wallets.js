/**
 * Curator payout wallets — platform-custodial bootstrap + migration.
 *
 * Private keys live ONLY in CURATOR_PAYOUT_KEYS_PATH (or CURATOR_PAYOUT_KEYS_JSON).
 * Neon stores the public address in curators.commerce.walletAddress and
 * commerce.payoutWalletStatus.
 *
 * Bootstrap: generate per-slug Celo wallet → agent checkout works immediately.
 * Migrate: sweep cUSD to curator's own address → set payoutWalletStatus curator_owned.
 */

const fs = require('fs');
const path = require('path');
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
const { createPublicClient } = require('viem');
const { celo } = require('viem/chains');
const agentCore = require('@repo/agent-core');
const sharedTypes = require('@onpoint/shared-types');
const logger = require('./logger');

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

function keysPath() {
  return (
    process.env.CURATOR_PAYOUT_KEYS_PATH
    || path.join(__dirname, '..', '.curator-payout-keys.json')
  );
}

function loadStore() {
  const jsonEnv = process.env.CURATOR_PAYOUT_KEYS_JSON;
  if (jsonEnv) {
    try {
      return JSON.parse(jsonEnv);
    } catch (err) {
      throw new Error('CURATOR_PAYOUT_KEYS_JSON is not valid JSON');
    }
  }

  const filePath = keysPath();
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function saveStore(store) {
  if (process.env.CURATOR_PAYOUT_KEYS_JSON) {
    throw new Error(
      'Cannot write curator payout keys when CURATOR_PAYOUT_KEYS_JSON is set — use a file path instead',
    );
  }
  const filePath = keysPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

function isValidAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function getCustodialEntry(slug) {
  const store = loadStore();
  return store[slug] || null;
}

function hasCustodialWallet(slug) {
  const entry = getCustodialEntry(slug);
  return Boolean(entry?.privateKey && entry?.address);
}

/**
 * Generate a new custodial wallet for a curator slug.
 * @returns {{ address: string, createdAt: string, alreadyExisted: boolean }}
 */
function generateCustodialWallet(slug) {
  if (!/^[a-z0-9-]{2,48}$/.test(slug)) {
    throw new Error('Invalid curator slug');
  }

  const store = loadStore();
  const existing = store[slug];
  if (existing?.address && existing?.privateKey) {
    return {
      address: existing.address,
      createdAt: existing.createdAt || new Date().toISOString(),
      alreadyExisted: true,
    };
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const createdAt = new Date().toISOString();

  store[slug] = {
    address: account.address,
    privateKey,
    createdAt,
  };
  saveStore(store);

  logger.info('Custodial payout wallet generated', {
    component: 'curator-payout-wallets',
    slug,
    address: account.address,
  });

  return {
    address: account.address,
    createdAt,
    alreadyExisted: false,
  };
}

function removeCustodialWallet(slug) {
  const store = loadStore();
  if (!store[slug]) return false;
  delete store[slug];
  saveStore(store);
  return true;
}

function buildCommerceWithCustodialWallet(commerce, address) {
  return {
    ...(commerce || {}),
    walletAddress: address,
    payoutWalletStatus: 'platform_custodial',
    payoutWalletProvisionedAt: new Date().toISOString(),
    // Custodial bootstrap — splits lock recipients; deploy after curator_owned.
    splitAddress: undefined,
    splitTxHash: undefined,
  };
}

function buildCommerceWithCuratorOwnedWallet(commerce, address, provider = 'manual') {
  const next = {
    ...(commerce || {}),
    walletAddress: address,
    payoutWalletStatus: 'curator_owned',
    payoutWalletProvider: provider,
    payoutWalletClaimedAt: new Date().toISOString(),
  };
  delete next.splitAddress;
  delete next.splitTxHash;
  return next;
}

async function getCusdBalance(address) {
  const transport = agentCore.createTransport('celo');
  const publicClient = createPublicClient({ chain: celo, transport });
  return publicClient.readContract({
    address: sharedTypes.X402_ASSET,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  });
}

/**
 * Sweep all cUSD from a custodial wallet to a curator-owned address.
 * @returns {{ txHash: string | null, amountWei: string, skipped: boolean }}
 */
async function sweepCustodialWallet(slug, toAddress) {
  if (!isValidAddress(toAddress)) {
    throw new Error('toAddress must be a valid 0x address');
  }

  const entry = getCustodialEntry(slug);
  if (!entry?.privateKey || !entry?.address) {
    throw new Error(`No custodial payout wallet for curator: ${slug}`);
  }

  const balance = await getCusdBalance(entry.address);
  if (balance === 0n) {
    return { txHash: null, amountWei: '0', skipped: true };
  }

  const result = await agentCore.ERC20.transfer({
    chain: 'celo',
    tokenAddress: sharedTypes.X402_ASSET,
    to: toAddress,
    amount: balance,
    privateKey: entry.privateKey,
  });

  logger.info('Custodial payout wallet swept', {
    component: 'curator-payout-wallets',
    slug,
    from: entry.address,
    to: toAddress,
    amountWei: balance.toString(),
    txHash: result.hash,
  });

  return {
    txHash: result.hash,
    amountWei: balance.toString(),
    skipped: false,
  };
}

module.exports = {
  keysPath,
  loadStore,
  generateCustodialWallet,
  hasCustodialWallet,
  getCustodialEntry,
  removeCustodialWallet,
  buildCommerceWithCustodialWallet,
  buildCommerceWithCuratorOwnedWallet,
  sweepCustodialWallet,
  getCusdBalance,
  isValidAddress,
};
