// Blockchain client for interacting with smart contracts and 0xSplits

import { type Address, type PublicClient, type WalletClient, type Chain } from 'viem';
import { SplitsClient } from '@0xsplits/splits-sdk';

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
}

export interface ContractConfig {
  address: Address;
  abi: any[];
}

export interface MintResult {
  transactionHash: string;
  tokenId: string;
  splitAddress?: Address;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface SplitRecipient {
  address: Address;
  percentAllocation: number; // e.g., 85.0 for 85%
}

export interface CreateSplitParams {
  recipients: SplitRecipient[];
  distributorFee?: number; // defaults to 0.1 (0.1%)
  controller?: Address; // defaults to 0x0 (immutable)
}

// Initialize 0xSplits client
export function createSplitsClient(
  chainId: number,
  publicClient: PublicClient,
  walletClient?: WalletClient
): SplitsClient {
  // Extract the chain from the public client
  const chain = publicClient.chain;
  
  // Create a new public client with the chain explicitly set if it's missing
  const clientWithChain = chain 
    ? publicClient 
    : { ...publicClient, chain: undefined };
  
  return new SplitsClient({
    chainId,
    publicClient: clientWithChain as PublicClient<Chain>,
    walletClient,
  });
}

// Create a split for NFT royalty distribution
export async function createRoyaltySplit(
  splitsClient: SplitsClient,
  params: CreateSplitParams
): Promise<{ splitAddress: Address; transactionHash: string }> {
  const { recipients, distributorFee = 0.1, controller = '0x0000000000000000000000000000000000000000' } = params;

  const result = await splitsClient.createSplit({
    recipients,
    distributorFee,
    controller: controller as Address,
  });

  return {
    splitAddress: result.splitAddress,
    transactionHash: result.txHash,
  };
}

// Mint NFT with 0xSplits royalty integration
export async function mintNFTWithSplit(
  contractConfig: ContractConfig,
  metadataUri: string,
  splitParams: CreateSplitParams,
  splitsClient: SplitsClient
): Promise<MintResult> {
  try {
    // 1. Create split for royalty distribution
    const { splitAddress, transactionHash: splitTxHash } = await createRoyaltySplit(
      splitsClient,
      splitParams
    );

    // 2. Mint NFT with split address as royalty recipient
    // This is still a stub - will be implemented with actual contract
    console.log('Minting NFT with metadata URI:', metadataUri);
    console.log('Split address for royalties:', splitAddress);
    console.log('Split creation tx:', splitTxHash);

    return {
      transactionHash: '0x1234567890abcdef', // TODO: Replace with actual mint tx
      tokenId: '1',
      splitAddress,
      status: 'pending'
    };
  } catch (error) {
    console.error('Failed to mint NFT with split:', error);
    throw error;
  }
}

// Distribute split earnings
export async function distributeSplit(
  splitsClient: SplitsClient,
  splitAddress: Address,
  tokens: Address[] = [], // Empty array for ETH only
  distributorAddress?: Address
): Promise<{ transactionHash: string }> {
  const result = await splitsClient.distributeToken({
    splitAddress,
    token: tokens.length > 0 ? tokens[0] : '0x0000000000000000000000000000000000000000', // ETH
    distributorAddress,
  });

  return {
    transactionHash: result.txHash,
  };
}

// Get split balance
export async function getSplitBalance(
  splitsClient: SplitsClient,
  splitAddress: Address,
  token?: Address
): Promise<{ balance: bigint; formattedBalance: string }> {
  const balance = await splitsClient.getSplitBalance({
    splitAddress,
    token: token || '0x0000000000000000000000000000000000000000', // ETH by default
  });

  return {
    balance: balance.result,
    formattedBalance: balance.formatted,
  };
}

// Legacy function for backward compatibility
export async function mintNFT(
  contractConfig: ContractConfig,
  metadataUri: string
): Promise<MintResult> {
  console.log('Using legacy mint function - consider upgrading to mintNFTWithSplit');
  return {
    transactionHash: '0x1234567890abcdef',
    tokenId: '1',
    status: 'pending'
  };
}

