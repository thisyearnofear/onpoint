/**
 * Chain Configuration — Web Layer
 *
 * This file re-exports core chain data from @repo/agent-core and adds
 * wagmi/RainbowKit-specific chain objects for the web app.
 *
 * Core chain data (addresses, URLs, contract addresses):
 *   → Import from @repo/agent-core
 *
 * Wagmi chain objects:
 *   → Re-exported from @repo/agent-core where they are viem-compatible
 *   → Additional chains (mainnet, sepolia, arbitrum, zetaChain, lisk)
 *     defined here with wagmi imports
 */

import {
  type ChainName,
  AGENT_WALLET,
  PLATFORM_WALLET,
  base,
  celo,
  celoSepolia,
  RPC_URLS,
  EXPLORER_URLS,
  TOKEN_ADDRESSES,
  NFT_CONTRACTS,
  getExplorerUrl,
  getTokenAddress,
  getNFTContract,
  supportsCUSD,
  supportsNFTMinting,
} from "@repo/agent-core";

export {
  type ChainName,
  AGENT_WALLET,
  PLATFORM_WALLET,
  base,
  celo,
  celoSepolia,
  RPC_URLS,
  EXPLORER_URLS,
  TOKEN_ADDRESSES,
  NFT_CONTRACTS,
  getExplorerUrl,
  getTokenAddress,
  getNFTContract,
  supportsCUSD,
  supportsNFTMinting,
};

import { mainnet, sepolia } from "wagmi/chains";

// ============================================
// Additional Wagmi Chains (not in core)
// ============================================

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
