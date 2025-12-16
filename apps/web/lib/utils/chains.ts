import { config } from '../../config/wagmi';

/**
 * Single source of truth for chain-related utilities
 * Follows DRY principle and provides clean separation of concerns
 */

export const getAllChains = () => {
  return config.chains;
};

export const getChainById = (chainId: number) => {
  return config.chains.find(chain => chain.id === chainId);
};

export const getChainName = (chainId: number) => {
  return getChainById(chainId)?.name || 'Unknown Network';
};

export const getChainIcon = (chainId: number) => {
  const chain = getChainById(chainId);
  if (!chain) return null;
  
  // Simple icon based on chain name initial
  return chain.name.charAt(0);
};

export const getChainColor = (chainId: number) => {
  // Simple color mapping based on chain ID for visual distinction
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500',
    'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
  ];
  return colors[chainId % colors.length];
};

export const getChainFeatures = (chainId: number) => {
  const features = {
    1: 'Ethereum Mainnet - Most secure and widely adopted',
    8453: 'Base - Low-cost Ethereum L2 by Coinbase',
    42161: 'Arbitrum - Scalable Ethereum rollup',
    42220: 'Celo - Mobile-first blockchain with stable assets',
    1135: 'Lisk - Interoperable blockchain platform',
    7000: 'ZetaChain - Omnichain smart contract platform',
    11155111: 'Sepolia - Ethereum testnet'
  };
  
  return features[chainId] || 'Blockchain network for fashion NFTs';
};

export const getSupportedChainsForDisplay = () => {
  // Filter and sort chains for optimal display
  return getAllChains()
    .filter(chain => !chain.testnet || chain.id === 44787) // Include Celo Alfajores testnet
    .sort((a, b) => a.name.localeCompare(b.name));
};