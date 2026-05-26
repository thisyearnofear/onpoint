/**
 * Autonomous Execution Engine
 *
 * When an agent suggestion is auto-approved (below autonomy threshold)
 * or manually accepted by the user, this engine executes the action
 * onchain without requiring further user interaction.
 *
 * For Celo Proof of Ship — AI Agent Track:
 *   "Agent with autonomous decision-making"
 *   "Small actions auto-execute, large ones require approval"
 *
 * Supported actions:
 *   - mint:     Calls /api/agent/mint logic directly
 *   - purchase: Calls /api/agent/purchase logic directly
 *   - tip:      Calls /api/agent/tip-agent logic directly
 *   - checkout: Calls /api/agent/checkout logic directly
 */

import {
  type Address,
  parseEther,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { celo } from "viem/chains";
import {
  AgentControls,
  type ActionType,
} from "../middleware/agent-controls";
import { getAgentWallet } from "./agent-wallet";
import { mintNFTWithSplit, createSplitsClient } from "@repo/blockchain-client";
import { ERC20 } from "../utils/erc20";
import {
  NFT_CONTRACTS,
  PLATFORM_WALLET,
  AGENT_WALLET,
  getExplorerUrl,
  celoSepolia,
} from "../../config/chains";
import { recordReceipt } from "./agent-registry";
import { logger } from "../utils/logger";

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  tokenId?: string;
  explorerUrl?: string;
  error?: string;
  action: ActionType;
  autoApproved: boolean;
}

/**
 * Execute a suggestion onchain after it has been accepted.
 *
 * This is the core of agent autonomy: once the suggestion passes
 * spending limits and fraud checks, the agent signs and broadcasts
 * the transaction itself.
 */
export async function executeSuggestion(params: {
  agentId: string;
  userId: string;
  userAddress: string;
  actionType: ActionType;
  amount: string;
  description: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
  suggestionId: string;
}): Promise<ExecutionResult> {
  const {
    agentId,
    userId,
    userAddress,
    actionType,
    amount,
    description,
    recipient,
    metadata,
    suggestionId,
  } = params;

  // Resolve agent wallet
  const agentWallet = await getAgentWallet();
  const addresses = await agentWallet.getAddresses();
  const celoAddress = addresses.celo || Object.values(addresses)[0];

  if (!celoAddress) {
    return {
      success: false,
      error: "Agent wallet address not resolved",
      action: actionType,
      autoApproved: true,
    };
  }

  // Get agent private key
  const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
  if (!agentPrivateKey) {
    return {
      success: false,
      error: "AGENT_PRIVATE_KEY not configured — cannot execute autonomously",
      action: actionType,
      autoApproved: true,
    };
  }

  // Execute based on action type
  switch (actionType) {
    case "mint": {
      return executeMint(params, agentPrivateKey, celoAddress);
    }
    case "purchase": {
      return executePurchase(params, agentPrivateKey, celoAddress);
    }
    case "tip": {
      return executeTip(params, agentPrivateKey, celoAddress);
    }
    case "external_search": {
      // External search is informational — no onchain tx needed
      return {
        success: true,
        action: actionType,
        autoApproved: true,
      };
    }
    default: {
      return {
        success: false,
        error: `Autonomous execution not yet implemented for action: ${actionType}`,
        action: actionType,
        autoApproved: true,
      };
    }
  }
}

// ============================================
// Individual Action Executors
// ============================================

async function executeMint(
  params: ReturnType<typeof executeSuggestion> extends Promise<infer R> ? Parameters<typeof executeSuggestion>[0] : never,
  agentPrivateKey: `0x${string}`,
  agentAddress: string,
): Promise<ExecutionResult> {
  const { userAddress, description, suggestionId } = params;

  try {
    const chain = "celo";
    const nftContract = NFT_CONTRACTS[chain];
    if (!nftContract) {
      return { success: false, error: "NFT contract not on Celo", action: "mint", autoApproved: true };
    }

    const chainConfig = celo;
    const rpcUrl = "https://forno.celo.org";

    const publicClient = createPublicClient({ chain: chainConfig, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account: agentPrivateKey, chain: chainConfig, transport: http(rpcUrl) });

    const splitsClient = createSplitsClient(chainConfig.id, publicClient as any, walletClient as any);

    // Use a placeholder metadata URI based on description
    const metadataUri = `ipfs://onpoint/autonomous/${suggestionId}`;

    const result = await mintNFTWithSplit(
      walletClient as any,
      publicClient as any,
      nftContract as Address,
      metadataUri,
      {
        recipients: [
          { address: userAddress as Address, percentAllocation: 85 },
          { address: PLATFORM_WALLET as Address, percentAllocation: 15 },
        ],
      },
      splitsClient,
    );

    // Record spending
    AgentControls.recordSpending(params.agentId, params.userId, "mint", parseEther("0.01"));

    // Record verifiable receipt
    await recordReceipt({
      action: "mint_nft",
      sessionId: suggestionId,
      metadata: {
        description,
        tokenId: result.tokenId,
        userAddress,
        autoApproved: true,
      },
      txHash: result.transactionHash,
      chain: "celo",
      onChain: true,
    });

    return {
      success: true,
      txHash: result.transactionHash,
      tokenId: result.tokenId,
      explorerUrl: getExplorerUrl(chain, result.transactionHash),
      action: "mint",
      autoApproved: true,
    };
  } catch (err: any) {
    logger.error("Autonomous mint failed", { component: "autonomous-executor" }, err);
    return { success: false, error: err.message, action: "mint", autoApproved: true };
  }
}

async function executePurchase(
  params: ReturnType<typeof executeSuggestion> extends Promise<infer R> ? Parameters<typeof executeSuggestion>[0] : never,
  agentPrivateKey: `0x${string}`,
  agentAddress: string,
): Promise<ExecutionResult> {
  const { userAddress, amount, description, recipient, suggestionId } = params;

  try {
    const chain = "celo";
    const cUSDAddress = ERC20.getCUSDAddress(chain);
    if (!cUSDAddress) {
      return { success: false, error: "cUSD not available on Celo", action: "purchase", autoApproved: true };
    }

    // Parse amount (remove currency suffix)
    const cleanedAmount = amount.replace(/[^0-9.]/g, "");
    const amountWei = parseEther(cleanedAmount || "0");

    // If no recipient, default to platform wallet
    const to = recipient || PLATFORM_WALLET;

    const transferResult = await ERC20.transfer({
      chain,
      tokenAddress: cUSDAddress,
      to: to as Address,
      amount: amountWei,
      privateKey: agentPrivateKey,
    });

    // Record spending
    AgentControls.recordSpending(params.agentId, params.userId, "purchase", amountWei);

    // Record verifiable receipt
    await recordReceipt({
      action: "propose_mint_nft",
      sessionId: suggestionId,
      metadata: {
        description,
        amount,
        recipient: to,
        userAddress,
        autoApproved: true,
      },
      txHash: transferResult.hash,
      chain: "celo",
      onChain: true,
    });

    return {
      success: true,
      txHash: transferResult.hash,
      explorerUrl: getExplorerUrl(chain, transferResult.hash),
      action: "purchase",
      autoApproved: true,
    };
  } catch (err: any) {
    logger.error("Autonomous purchase failed", { component: "autonomous-executor" }, err);
    return { success: false, error: err.message, action: "purchase", autoApproved: true };
  }
}

async function executeTip(
  params: ReturnType<typeof executeSuggestion> extends Promise<infer R> ? Parameters<typeof executeSuggestion>[0] : never,
  agentPrivateKey: `0x${string}`,
  agentAddress: string,
): Promise<ExecutionResult> {
  const { userAddress, amount, description, recipient, suggestionId } = params;

  try {
    const chain = "celo";
    const cUSDAddress = ERC20.getCUSDAddress(chain);
    if (!cUSDAddress) {
      return { success: false, error: "cUSD not available on Celo", action: "tip", autoApproved: true };
    }

    const cleanedAmount = amount.replace(/[^0-9.]/g, "");
    const amountWei = parseEther(cleanedAmount || "0");

    // Tips go to the agent wallet
    const to = recipient || AGENT_WALLET;

    const transferResult = await ERC20.transfer({
      chain,
      tokenAddress: cUSDAddress,
      to: to as Address,
      amount: amountWei,
      privateKey: agentPrivateKey,
    });

    AgentControls.recordSpending(params.agentId, params.userId, "tip", amountWei);

    await recordReceipt({
      action: "tip_sent",
      sessionId: suggestionId,
      metadata: {
        description,
        amount,
        recipient: to,
        userAddress,
        autoApproved: true,
      },
      txHash: transferResult.hash,
      chain: "celo",
      onChain: true,
    });

    return {
      success: true,
      txHash: transferResult.hash,
      explorerUrl: getExplorerUrl(chain, transferResult.hash),
      action: "tip",
      autoApproved: true,
    };
  } catch (err: any) {
    logger.error("Autonomous tip failed", { component: "autonomous-executor" }, err);
    return { success: false, error: err.message, action: "tip", autoApproved: true };
  }
}
