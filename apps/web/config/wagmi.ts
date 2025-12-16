import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createStorage, http } from 'wagmi';
// Importing commonly available chains
import { mainnet, sepolia } from 'wagmi/chains';
// We'll define additional chains manually if they're not available in wagmi/chains

// Define additional chains that may not be in wagmi/chains
const base = {
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'Basescan', url: 'https://basescan.org' },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 5022,
    },
  },
} as const;

const arbitrum = {
  id: 42161,
  name: 'Arbitrum One',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://arb1.arbitrum.io/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Arbiscan', url: 'https://arbiscan.io' },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 7654707,
    },
  },
} as const;

const celo = {
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
  },
  blockExplorers: {
    default: { name: 'CeloScan', url: 'https://celoscan.io' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 13112599,
    },
  },
  testnet: false,
} as const;

const celoAlfajores = {
  id: 44787,
  name: 'Celo Alfajores',
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://alfajores-forno.celo-testnet.org'] },
  },
  blockExplorers: {
    default: { name: 'CeloScan', url: 'https://alfajores.celoscan.io' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 14569024,
    },
  },
  testnet: true,
} as const;

// Note: ZetaChain may need to be added via a custom RPC if not available
const zetaChain = {
  id: 7000,
  name: 'ZetaChain',
  nativeCurrency: { name: 'Zeta', symbol: 'ZETA', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://zetachain-evm.blockpi.network/v1/rpc/public'] },
  },
  blockExplorers: {
    default: { name: 'ZetaScan', url: 'https://explorer.zetachain.com' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 1564717,
    },
  },
  testnet: false,
} as const;

// Lisk Mainnet configuration
const lisk = {
  id: 1135,
  name: 'Lisk',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.api.lisk.com'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://blockscout.lisk.com' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 1,
    },
  },
  testnet: false,
} as const;

// Custom storage that works on both client and server
const customStorage = typeof window !== 'undefined'
  ? undefined // Use default storage on client
  : createStorage({
    storage: {
      getItem: () => null,
      setItem: () => { },
      removeItem: () => { },
    },
  });

export const config = getDefaultConfig({
  appName: 'BeOnPoint',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [mainnet, base, arbitrum, celo, celoAlfajores, zetaChain, lisk, sepolia],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [celo.id]: http(),
    [celoAlfajores.id]: http(process.env.NEXT_PUBLIC_CELO_ALFAJORES_RPC_URL),
    [zetaChain.id]: http(),
    [lisk.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
  storage: customStorage,
});