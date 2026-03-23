import { mainnet, sepolia } from "wagmi/chains";
import { type Address } from "viem";

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

/** Platform fee wallet - receives 15% of NFT sales */
export const PLATFORM_WALLET =
  "0x05f012C12123D69E8324A251ae7D15A92C4549c1" as Address;

/** Agent wallet for AI Stylist operations */
export const AGENT_WALLET =
  "0x05f012C12123D69E8324A251ae7D15A92C4549c1" as Address;

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

export const arbitrum = {
  id: 42161,
  name: "Arbitrum One",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://arb1.arbitrum.io/rpc"] },
  },
  blockExplorers: {
    default: { name: "Arbiscan", url: "https://arbiscan.io" },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 7654707,
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
      address: "0x765DE8164458C172EE097029dfb482Ff182ad001",
    },
    OnPointNFT: {
      address: "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1",
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

export const zetaChain = {
  id: 7000,
  name: "ZetaChain",
  nativeCurrency: { name: "Zeta", symbol: "ZETA", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://zetachain-evm.blockpi.network/v1/rpc/public"] },
  },
  blockExplorers: {
    default: { name: "ZetaScan", url: "https://explorer.zetachain.com" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 1564717,
    },
  },
  testnet: false,
} as const;

export const lisk = {
  id: 1135,
  name: "Lisk",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.api.lisk.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://blockscout.lisk.com" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 1,
    },
  },
  testnet: false,
} as const;

export const allConfiguredChains = [
  mainnet,
  base,
  arbitrum,
  celo,
  celoSepolia,
  zetaChain,
  lisk,
  sepolia,
];

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
    celo: "0x765DE8164458C172EE097029dfb482Ff182ad001" as Address,
    celoSepolia: null, // Redeploy cUSD on Sepolia and update
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
} as const;

export const NFT_CONTRACTS = {
  celo: "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1" as Address,
  celoSepolia: null, // Redeploy OnPointNFT on Sepolia and update
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
