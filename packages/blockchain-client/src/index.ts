// Blockchain client for interacting with smart contracts and 0xSplits

import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { SplitsClient } from "@0xsplits/splits-sdk";
import { type WalletAdapter } from "@onpoint/shared-types";

export { type WalletAdapter, type WalletAdapterType } from "@onpoint/shared-types";
export { createWalletAdapter } from './factory';
export { StandardWalletAdapter } from './adapters/standard-adapter';
export { MiniPayAdapter } from './adapters/minipay-adapter';

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
  status: "pending" | "confirmed" | "failed";
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

// Initialize 0xSplits client.
// Accepts a WalletAdapter so that all transactions (including split creation)
// are routed through the adapter's sendTransaction (preserving feeCurrency
// injection for MiniPay).
export function createSplitsClient(
  chainId: number,
  publicClient: PublicClient,
  walletAdapterOrClient?: WalletAdapter | WalletClient,
): SplitsClient {
  let walletClientForSplits: WalletClient | undefined;

  if (walletAdapterOrClient && 'wrapForSdk' in walletAdapterOrClient) {
    // It's a WalletAdapter — wrap it so sendTransaction is routed through the adapter
    walletClientForSplits = walletAdapterOrClient.wrapForSdk();
  } else {
    // Legacy path: raw WalletClient passed directly
    walletClientForSplits = walletAdapterOrClient as WalletClient | undefined;
  }

  return new SplitsClient({
    chainId,
    publicClient: publicClient as any,
    walletClient: walletClientForSplits as any,
  });
}

// Create a split for NFT royalty distribution
export async function createRoyaltySplit(
  splitsClient: SplitsClient,
  params: CreateSplitParams,
): Promise<{ splitAddress: Address; transactionHash: string }> {
  const {
    recipients,
    distributorFee = 0.1,
    controller = "0x0000000000000000000000000000000000000000",
  } = params;

  const result = await (splitsClient as any).createSplit({
    recipients,
    distributorFee,
    controller: controller as Address,
  });

  return {
    splitAddress: result.splitAddress,
    transactionHash: result.txHash,
  };
}

// Standard ERC-721A + Royalty Extension ABI
const ONPOINT_NFT_ABI = [
  {
    name: "mintWithRoyalty",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "uri", type: "string" },
      { name: "royaltyRecipient", type: "address" },
      { name: "royaltyBps", type: "uint96" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

// Mint NFT with 0xSplits royalty integration
export async function mintNFTWithSplit(
  walletAdapter: WalletAdapter,
  publicClient: PublicClient,
  contractAddress: Address,
  metadataUri: string,
  splitParams: CreateSplitParams,
  splitsClient: SplitsClient,
  royaltyBps: number = 500,
): Promise<MintResult> {
  try {
    const account = await walletAdapter.getAddress();
    if (!account) throw new Error("No account connected");

    // 1. Create split for royalty distribution
    const { splitAddress, transactionHash: splitTxHash } =
      await createRoyaltySplit(splitsClient, splitParams);

    console.log("Split created at:", splitAddress, "tx:", splitTxHash);

    // 2. Mint NFT using the split address for royalties
    const { request } = await publicClient.simulateContract({
      account,
      address: contractAddress,
      abi: ONPOINT_NFT_ABI,
      functionName: "mintWithRoyalty",
      args: [account, metadataUri, splitAddress, BigInt(royaltyBps)],
    });

    const hash = await walletAdapter.sendTransaction(request as any);

    // Wait for transaction
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return {
      transactionHash: hash,
      tokenId: receipt.logs[0]?.topics[3] || "1", // Simplified tokenId extraction
      splitAddress,
      status: receipt.status === "success" ? "confirmed" : "failed",
    };
  } catch (error) {
    console.error("Failed to mint NFT with split:", error);
    throw error;
  }
}

// Distribute split earnings
export async function distributeSplit(
  splitsClient: SplitsClient,
  splitAddress: Address,
  tokens: Address[] = [], // Empty array for ETH only
  distributorAddress?: Address,
): Promise<{ transactionHash: string }> {
  const result = await (splitsClient as any).distributeToken({
    splitAddress,
    token:
      tokens.length > 0
        ? tokens[0]
        : "0x0000000000000000000000000000000000000000", // ETH
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
  token?: Address,
): Promise<{ balance: bigint; formattedBalance: string }> {
  const balance = await (splitsClient as any).getSplitBalance({
    splitAddress,
    token: token || "0x0000000000000000000000000000000000000000", // ETH by default
  });

  return {
    balance: balance.result,
    formattedBalance: balance.formatted,
  };
}

// Legacy function for backward compatibility
// ⚠️ DEPRECATED: Use mintNFTWithSplit for real on-chain minting
export async function mintNFT(
  contractConfig: ContractConfig,
  metadataUri: string,
): Promise<MintResult> {
  throw new Error(
    "mintNFT is deprecated. Use mintNFTWithSplit for real on-chain NFT minting with commission splits. " +
      "Ensure AGENT_PRIVATE_KEY is configured in your environment.",
  );
}
