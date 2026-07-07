/**
 * ERC-20 Token Utilities
 *
 * Provides ERC-20 token operations using viem directly.
 * Uses centralized chain configuration from @repo/agent-core/chains.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Address,
  type Hash,
} from "viem";
import { celo, base, mainnet, polygon } from "viem/chains";
import { type ChainName, RPC_URLS, TOKEN_ADDRESSES, getExplorerUrl, createTransport } from "./chains";

const CHAIN_OBJECTS: Record<string, any> = {
  celo,
  celoSepolia: { ...celo, id: 11142220 },
  base,
  ethereum: mainnet,
  polygon,
};

// ============================================
// Types
// ============================================

export interface ERC20Balance {
  token: Address;
  symbol: string;
  decimals: number;
  balance: bigint;
  formattedBalance: string;
}

export interface TransferParams {
  chain: ChainName;
  tokenAddress: Address;
  to: Address;
  amount: bigint;
  privateKey: `0x${string}`;
  /** Optional hex suffix appended to calldata (e.g. ERC-8021 attribution tag) */
  dataSuffix?: `0x${string}`;
}

export interface ApproveParams {
  chain: ChainName;
  tokenAddress: Address;
  spender: Address;
  amount: bigint;
  privateKey: `0x${string}`;
}

export interface TokenTransferResult {
  hash: Hash;
  from: Address;
  to: Address;
  amount: string;
  symbol: string;
}

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ============================================
// Read Operations
// ============================================

export async function getERC20Balance(
  chain: ChainName,
  tokenAddress: Address,
  walletAddress: Address,
): Promise<ERC20Balance> {
  const client = createPublicClient({
    chain: CHAIN_OBJECTS[chain],
    transport: createTransport(chain),
  });

  const [balance, decimals, symbol] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [walletAddress],
    }),
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
  ]);

  return {
    token: tokenAddress,
    symbol,
    decimals,
    balance: balance as bigint,
    formattedBalance: formatTokenBalance(balance as bigint, decimals),
  };
}

export async function getAllowance(
  chain: ChainName,
  tokenAddress: Address,
  owner: Address,
  spender: Address,
): Promise<bigint> {
  const client = createPublicClient({
    chain: CHAIN_OBJECTS[chain],
    transport: createTransport(chain),
  });

  const allowance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, spender],
  });

  return allowance as bigint;
}

export function getCUSDAddress(chain: ChainName): Address | null {
  return TOKEN_ADDRESSES.cUSD[chain];
}

export interface TransferVerification {
  verified: boolean;
  reason?: string;
  from?: Address;
  amount?: bigint;
  blockNumber?: bigint;
}

const TRANSFER_EVENT = {
  name: "Transfer",
  type: "event",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

/**
 * Verify that a confirmed transaction transferred at least `minAmount` of
 * `tokenAddress` to `to`. Used to validate payment proofs submitted by
 * external agents (they pay from their own wallet, then present the txHash).
 */
export async function verifyTokenTransfer(params: {
  chain: ChainName;
  tokenAddress: Address;
  txHash: Hash;
  to: Address;
  minAmount: bigint;
}): Promise<TransferVerification> {
  const { chain, tokenAddress, txHash, to, minAmount } = params;

  const client = createPublicClient({
    chain: CHAIN_OBJECTS[chain],
    transport: createTransport(chain),
  });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    return { verified: false, reason: "Transaction not found or not yet confirmed" };
  }

  if (receipt.status !== "success") {
    return { verified: false, reason: "Transaction reverted" };
  }

  const { parseEventLogs } = await import("viem");
  const transfers = parseEventLogs({
    abi: [TRANSFER_EVENT],
    logs: receipt.logs,
    eventName: "Transfer",
  }).filter(
    (log) =>
      log.address.toLowerCase() === tokenAddress.toLowerCase() &&
      log.args.to.toLowerCase() === to.toLowerCase(),
  );

  if (transfers.length === 0) {
    return { verified: false, reason: "No matching token transfer to recipient in transaction" };
  }

  const total = transfers.reduce((sum, log) => sum + log.args.value, 0n);
  if (total < minAmount) {
    return {
      verified: false,
      reason: `Insufficient amount: got ${formatEther(total)}, need ${formatEther(minAmount)}`,
    };
  }

  return {
    verified: true,
    from: transfers[0]?.args.from,
    amount: total,
    blockNumber: receipt.blockNumber,
  };
}

export function getTokenAddress(
  symbol: keyof typeof TOKEN_ADDRESSES,
  chain: ChainName,
): Address | null {
  return TOKEN_ADDRESSES[symbol]?.[chain] ?? null;
}

// ============================================
// Write Operations
// ============================================

export async function transferToken(
  params: TransferParams,
): Promise<TokenTransferResult> {
  const { chain, tokenAddress, to, amount, privateKey, dataSuffix } = params;
  const viemChain = CHAIN_OBJECTS[chain];

  const client = createWalletClient({
    account: privateKey,
    chain: viemChain,
    transport: createTransport(chain),
  });

  // Encode the transfer calldata, then append the attribution suffix
  // (ERC-8021). The EVM ignores trailing bytes after the function args,
  // so the transfer call is unaffected but the tx is tagged on-chain.
  let txData: `0x${string}` | undefined;
  if (dataSuffix && dataSuffix !== "0x") {
    const { encodeFunctionData } = await import("viem");
    const encoded = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to, amount],
    });
    txData = (encoded + dataSuffix.slice(2)) as `0x${string}`;
  }

  const hash = txData
    ? await client.sendTransaction({
        to: tokenAddress,
        data: txData,
        chain: viemChain,
      })
    : await client.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [to, amount],
        chain: viemChain,
      });

  const publicClient = createPublicClient({
    chain: viemChain,
    transport: createTransport(chain),
  });

  const [decimals, symbol] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
  ]);

  return {
    hash,
    from: client.account.address,
    to,
    amount: formatTokenBalance(amount, decimals),
    symbol,
  };
}

export async function approveToken(params: ApproveParams): Promise<Hash> {
  const { chain, tokenAddress, spender, amount, privateKey } = params;
  const viemChain = CHAIN_OBJECTS[chain];

  const client = createWalletClient({
    account: privateKey,
    chain: viemChain,
    transport: createTransport(chain),
  });

  const hash = await client.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, amount],
    chain: viemChain,
  });

  return hash;
}

export async function transferCUSD(
  chain: ChainName,
  to: Address,
  amount: string,
  privateKey: `0x${string}`,
): Promise<TokenTransferResult> {
  const tokenAddress = getCUSDAddress(chain);
  if (!tokenAddress) {
    throw new Error(`cUSD not available on ${chain}`);
  }

  return transferToken({
    chain,
    tokenAddress,
    to,
    amount: parseEther(amount),
    privateKey,
  });
}

// ============================================
// Helpers
// ============================================

function formatTokenBalance(balance: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = balance / divisor;
  const fractionalPart = balance % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");

  return `${integerPart}.${trimmedFractional}`;
}

// ============================================
// Export consolidated object
// ============================================

export const ERC20 = {
  getBalance: getERC20Balance,
  getAllowance,
  getCUSDAddress,
  getTokenAddress,
  transfer: transferToken,
  approve: approveToken,
  transferCUSD,
  verifyTransfer: verifyTokenTransfer,
  getExplorerUrl,
  parseEther,
  formatEther,
  TOKEN_ADDRESSES,
};
