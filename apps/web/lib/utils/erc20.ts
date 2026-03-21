/**
 * ERC-20 Token Utilities
 *
 * Provides ERC-20 token operations using viem directly.
 * Used alongside WDK (which handles native tokens).
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

// ============================================
// Configuration
// ============================================

type ChainName = "celo" | "celoAlfajores" | "base" | "ethereum" | "polygon";

const CHAIN_CONFIG: Record<
  ChainName,
  { id: number; name: string; rpc: string }
> = {
  celo: { id: 42220, name: "Celo", rpc: "https://forno.celo.org" },
  celoAlfajores: {
    id: 44787,
    name: "Celo Alfajores",
    rpc: "https://alfajores-forno.celo-testnet.org",
  },
  base: { id: 8453, name: "Base", rpc: "https://mainnet.base.org" },
  ethereum: { id: 1, name: "Ethereum", rpc: "https://eth.drpc.org" },
  polygon: { id: 137, name: "Polygon", rpc: "https://polygon.drpc.org" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHAIN_OBJECTS: Record<ChainName, any> = {
  celo,
  celoAlfajores,
  base,
  ethereum: mainnet,
  polygon,
};

const RPC_URLS: Record<ChainName, string> = {
  celo: CHAIN_CONFIG.celo.rpc,
  celoAlfajores: CHAIN_CONFIG.celoAlfajores.rpc,
  base: CHAIN_CONFIG.base.rpc,
  ethereum: CHAIN_CONFIG.ethereum.rpc,
  polygon: CHAIN_CONFIG.polygon.rpc,
};

const TOKEN_ADDRESSES: Record<string, Record<ChainName, Address | null>> = {
  cUSD: {
    celo: "0x765DE8164458C172EE097029dfb482Ff182ad001",
    celoAlfajores: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
    base: null,
    ethereum: null,
    polygon: null,
  },
  USDT: {
    celo: "0x48065d0d464B2E7f5C1c2B2A3778F3fC8116d8F5",
    celoAlfajores: null,
    base: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
};

// ERC-20 ABI
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

export function getCUSDAddress(chain: ChainName): Address | null {
  const cUSD = TOKEN_ADDRESSES.cUSD;
  if (!cUSD) return null;
  return cUSD[chain] ?? null;
}

export function getTokenAddress(
  symbol: string,
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
    chain: CHAIN_OBJECTS[chain],
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

  const amountWei = parseEther(amount);

  return transferToken({
    chain,
    tokenAddress,
    to,
    amount: amountWei,
    privateKey,
  });
}

// ============================================
// Utilities
// ============================================

export function getExplorerUrl(chain: ChainName, hash: string): string {
  const explorers: Record<ChainName, string> = {
    celo: "https://celoscan.io/tx/",
    celoAlfajores: "https://alfajores.celoscan.io/tx/",
    base: "https://basescan.org/tx/",
    ethereum: "https://etherscan.io/tx/",
    polygon: "https://polygonscan.com/tx/",
  };
  return `${explorers[chain]}${hash}`;
}

// ============================================
// Export
// ============================================

export const ERC20 = {
  getBalance: getERC20Balance,
  getAllowance,
  getCUSDAddress,
  getTokenAddress,
  transfer: transferToken,
  approve: approveToken,
  transferCUSD,
  getExplorerUrl,
  parseEther,
  formatEther,
  TOKEN_ADDRESSES,
  CHAIN_CONFIG,
};
