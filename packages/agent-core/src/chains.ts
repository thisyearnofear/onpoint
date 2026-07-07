/**
 * Chain Configuration — Single Source of Truth
 *
 * Extracted from apps/web/config/chains.ts for use across all packages
 * (agent-core, web, api, worker).
 *
 * This file contains *only* data definitions (addresses, URLs, chain objects).
 * Wagmi/RainbowKit-specific config lives in apps/web/config/chains.ts which
 * re-exports from here.
 */

import { type Address, http, fallback } from "viem";

// ============================================
// Chain Name Types
// ============================================

export type ChainName =
  | "celo"
  | "celoSepolia"
  | "base"
  | "ethereum"
  | "polygon"
  | "arbitrum";

// ============================================
// Platform Wallets
// ============================================

/**
 * Agent wallet — signs all agent-initiated transactions (mint, tips, purchases).
 * Also receives platform fees (15% of NFT sales).
 *
 * Private key lives in AGENT_PRIVATE_KEY env var (server-side only).
 * This address is derived from that key. To rotate, generate a new keypair
 * and update both this address and AGENT_PRIVATE_KEY in .env.
 */
export const AGENT_WALLET =
  "0x5b33E63440e95289207120B94da78CE22F9D24fB" as Address;

/** @deprecated Platform fee wallet — now routed to AGENT_WALLET */
export const PLATFORM_WALLET = AGENT_WALLET;

// ============================================
// Chain Definitions (viem-compatible shape)
// ============================================

export const base = {
  id: 8453,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.base.org"] },
  },
  blockExplorers: {
    default: { name: "Basescan", url: "https://basescan.org" },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 5022,
    },
  },
} as const;

export const celo = {
  id: 42220,
  name: "Celo",
  nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo.org"] },
  },
  blockExplorers: {
    default: { name: "CeloScan", url: "https://celoscan.io" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 13112599,
    },
    cUSD: {
      address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    },
    OnPointNFT: {
      address: "0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576",
    },
  },
  testnet: false,
} as const;

export const celoSepolia = {
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://celo-sepolia.g.alchemy.com/v2/W73tCsyRsW9JfV4orIbr7"],
    },
  },
  blockExplorers: {
    default: { name: "CeloScan", url: "https://sepolia.celoscan.io" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
  testnet: true,
} as const;

// ============================================
// RPC URLs (single source of truth)
// ============================================

export const RPC_URLS: Record<ChainName, string> = {
  celo: "https://forno.celo.org",
  celoSepolia: "https://celo-sepolia.g.alchemy.com/v2/W73tCsyRsW9JfV4orIbr7",
  base: "https://mainnet.base.org",
  ethereum: "https://eth.drpc.org",
  polygon: "https://polygon.drpc.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
};

/**
 * Fallback RPC endpoints — if the primary fails, viem tries these in order.
 * Public community endpoints first (free), then DRPC (decentralized, no key).
 * Override at runtime via env: CELO_RPC_FALLBACKS=url1,url2
 */
const RPC_FALLBACKS: Record<ChainName, string[]> = {
  celo: (process.env.CELO_RPC_FALLBACKS || "https://rpc.celo.org,https://celo.drpc.org")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  celoSepolia: [],
  base: ["https://base.drpc.org"],
  ethereum: ["https://eth.llamarpc.com"],
  polygon: ["https://polygon-rpc.com"],
  arbitrum: ["https://arbitrum.drpc.org"],
};

/**
 * Create a viem transport with automatic fallback across multiple RPCs.
 * Usage: `createPublicClient({ chain: celo, transport: createTransport("celo") })`
 *
 * viem's fallback() tries each transport in order and falls back on failure.
 */
export function createTransport(chain: ChainName) {
  const primary = RPC_URLS[chain];
  const fallbacks = RPC_FALLBACKS[chain] || [];
  if (fallbacks.length === 0) return http(primary);
  return fallback(
    [primary, ...fallbacks].map((url) => http(url)),
    { rank: false, retryCount: 2 },
  );
}

// ============================================
// Explorer URLs (single source of truth)
// ============================================

export const EXPLORER_URLS: Record<ChainName, string> = {
  celo: "https://celoscan.io/tx/",
  celoSepolia: "https://sepolia.celoscan.io/tx/",
  base: "https://basescan.org/tx/",
  ethereum: "https://etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  arbitrum: "https://arbiscan.io/tx/",
};

// ============================================
// Contract Addresses (single source of truth)
// ============================================

export const TOKEN_ADDRESSES = {
  cUSD: {
    celo: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
    celoSepolia: null,
    base: null,
    ethereum: null,
    polygon: null,
    arbitrum: null,
  },
  USDT: {
    celo: "0x48065d0d464B2E7f5C1c2B2A3778F3fC8116d8F5" as Address,
    celoSepolia: null,
    base: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as Address,
    ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address,
    polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" as Address,
    arbitrum: null,
  },
  /**
   * GoodDollar G$ — UBI token on Celo. Native Superfluid SuperToken (no
   * wrapping needed). ERC-20 surface, 18 decimals. ~$0.0001 USD price
   * with high short-term volatility — see ADR 0009.
   */
  GOOD_DOLLAR: {
    celo: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address,
    celoSepolia: null,
    base: null,
    ethereum: null,
    polygon: null,
    arbitrum: null,
  },
} as const;

/**
 * Superfluid CFAv1Forwarder — canonical forwarder on Celo mainnet.
 * Used by `@repo/gooddollar/streaming` for createFlow / updateFlow /
 * deleteFlow on G$ (a native SuperToken). Source:
 * https://docs.superfluid.finance/developers/constant-flow-agreement-cfa
 */
export const SUPERFLUID_CFA_FORWARDER = {
  celo: "0xcfA132E353cB4E398081B7F68C40dA562f0Fa1Da" as Address,
  celoSepolia: null,
  base: null,
  ethereum: null,
  polygon: null,
  arbitrum: null,
} as const;

export const NFT_CONTRACTS = {
  celo: "0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576" as Address,
  celoSepolia: null,
  base: null,
  ethereum: null,
  polygon: null,
  arbitrum: null,
} as const;

// ============================================
// Helper Functions
// ============================================

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(chain: ChainName, hash: string): string {
  return `${EXPLORER_URLS[chain]}${hash}`;
}

/**
 * Get token address by symbol and chain
 */
export function getTokenAddress(
  symbol: keyof typeof TOKEN_ADDRESSES,
  chain: ChainName,
): Address | null {
  return TOKEN_ADDRESSES[symbol]?.[chain] ?? null;
}

/**
 * Get NFT contract address for a chain
 */
export function getNFTContract(chain: ChainName): Address | null {
  return NFT_CONTRACTS[chain];
}

/**
 * Check if a chain supports cUSD
 */
export function supportsCUSD(chain: ChainName): boolean {
  return TOKEN_ADDRESSES.cUSD[chain] !== null;
}

/**
 * Check if a chain supports NFT minting
 */
export function supportsNFTMinting(chain: ChainName): boolean {
  return NFT_CONTRACTS[chain] !== null;
}

/**
 * GoodDollar G$ lives only on Celo mainnet today. This helper is the
 * single source of truth — every consumer that needs to resolve G$ should
 * call this rather than hardcoding `0x62B8B110...`. Returns null on any
 * non-Celo chain.
 */
export function getGTokenAddress(chain: ChainName): Address | null {
  return TOKEN_ADDRESSES.GOOD_DOLLAR[chain];
}

/**
 * True if the token is a native Superfluid SuperToken on the given chain.
 * Today this is true only for G$ on Celo. If GoodDollar migrates G$ to
 * another chain (or if we add another SuperToken), extend this list.
 */
export function isSuperfluidNativeToken(
  symbol: keyof typeof TOKEN_ADDRESSES,
  chain: ChainName,
): boolean {
  if (chain !== "celo") return false;
  return symbol === "GOOD_DOLLAR";
}

/**
 * Resolve the Superfluid CFAv1Forwarder address for a chain. Used by
 * `@repo/gooddollar/streaming` for createFlow / updateFlow / deleteFlow.
 * Returns null on chains where Superfluid is not deployed.
 */
export function getSuperfluidCFAForwarder(chain: ChainName): Address | null {
  return SUPERFLUID_CFA_FORWARDER[chain];
}
