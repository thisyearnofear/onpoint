/**
 * ERC-20 Token Utilities
 *
 * Provides ERC-20 token operations using viem directly.
 * Uses centralized chain configuration from /config/chains.ts.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
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
import { celo, celoAlfajores, base, mainnet, polygon } from "viem/chains";
import {
  type ChainName,
  RPC_URLS,
  TOKEN_ADDRESSES,
  getExplorerUrl as getExplorerUrlFromConfig,
} from "../../config/chains";

// Chain objects mapping (internal, not exported)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHAIN_OBJECTS: Record<string, any> = {
  celo,
  celoAlfajores,
  base,
  ethereum: mainnet,
  polygon,
};

// ============================================
// Types (use shared types when available)
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

// ERC-20 ABI (minimal set needed)
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
// Read Operations
// ============================================

export async function getERC20Balance(
  chain: ChainName,
  tokenAddress: Address,
  walletAddress: Address,
): Promise<ERC20Balance> {
  const client = createPublicClient({
    chain: CHAIN_OBJECTS[chain],
    transport: http(RPC_URLS[chain]),
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
    transport: http(RPC_URLS[chain]),
  });

  const allowance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, spender],
  });

  return allowance as bigint;
}

// Re-export from chains.ts for convenience
export function getCUSDAddress(chain: ChainName): Address | null {
  return TOKEN_ADDRESSES.cUSD[chain];
}

export function getTokenAddress(
  symbol: keyof typeof TOKEN_ADDRESSES,
  chain: ChainName,
): Address | null {
  return TOKEN_ADDRESSES[symbol]?.[chain] ?? null;
}

// Re-export from chains.ts
export { getExplorerUrlFromConfig as getExplorerUrl };

// ============================================
// Write Operations
// ============================================

export async function transferToken(
  params: TransferParams,
): Promise<TokenTransferResult> {
  const { chain, tokenAddress, to, amount, privateKey } = params;
  const viemChain = CHAIN_OBJECTS[chain];

  const client = createWalletClient({
    account: privateKey,
    chain: viemChain,
    transport: http(RPC_URLS[chain]),
  });

  const hash = await client.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, amount],
    chain: viemChain,
  });

  const publicClient = createPublicClient({
    chain: viemChain,
    transport: http(RPC_URLS[chain]),
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
    transport: http(RPC_URLS[chain]),
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
// Export consolidated object
// ============================================

export const ERC20 = {
  // Read
  getBalance: getERC20Balance,
  getAllowance,
  getCUSDAddress,
  getTokenAddress,

  // Write
  transfer: transferToken,
  approve: approveToken,
  transferCUSD,

  // Utils
  getExplorerUrl: getExplorerUrlFromConfig,
  parseEther,
  formatEther,

  // Constants from centralized config
  TOKEN_ADDRESSES,
};
