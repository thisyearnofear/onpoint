/**
 * Autonomous Execution Engine
 *
 * When an agent suggestion is auto-approved (below autonomy threshold)
 * or manually accepted by the user, this engine executes the action
 * onchain without requiring further user interaction.
 *
 * Features:
 * - Transaction retry with exponential backoff (3 attempts)
 * - Nonce management via Redis to prevent nonce-dance crashes
 * - Proper failed status tracking on suggestions
 */

import { type Address, parseEther, createPublicClient, createWalletClient, http, type WalletClient } from "viem";
import { celo } from "viem/chains";
import { AgentControls, type ActionType } from "./agent-controls";
import { getAgentWallet } from "./agent-wallet";
import { mintNFTWithSplit, createSplitsClient } from "@repo/blockchain-client";
import { ERC20 } from "./erc20";
import { NFT_CONTRACTS, PLATFORM_WALLET, AGENT_WALLET, getExplorerUrl } from "./chains";
import { recordReceipt } from "./agent-registry";
import { logger } from "./logger";
import { Metrics } from "./metrics";
import { getSignerClient, type SignerClient } from "./signer-client";

// ============================================
// Retry Configuration
// ============================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 10000;

// Keys for nonce tracking in Redis
const NONCE_KEY = (chain: string) => `executor:nonce:${chain}`;

/**
 * Delay helper using exponential backoff with jitter
 */
function backoffDelay(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = Math.random() * exponential * 0.2; // 0-20% jitter
  return Math.floor(exponential + jitter);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the next nonce for a chain using atomic Redis INCR.
 * This is safe for concurrent calls — Redis INCR is atomic.
 * Falls back to undefined (let viem manage nonces) if Redis is unavailable.
 */
async function getNextNonce(
  chainName: string,
  walletClient: WalletClient,
  agentAddress: Address,
): Promise<bigint | undefined> {
  try {
    const { redisIncr, isRedisConfigured } = await import("./redis-helpers");
    if (!isRedisConfigured()) return undefined;

    const key = NONCE_KEY(chainName);
    const incremented = await redisIncr(key);

    if (incremented === null) {
      return undefined;
    }

    if (incremented === 1) {
      // First increment — this was a new key, so use the chain's current nonce
      // Then increment again so next call gets nonce + 1
      const currentNonce = await (walletClient as any).getTransactionCount({ address: agentAddress });
      const { redisSet } = await import("./redis-helpers");
      await redisSet(key, (currentNonce + 1n).toString());
      return currentNonce;
    }

    // Redis already had a value, so we use (incremented - 1) as the nonce
    // The INCR already advanced the counter for the next caller
    return BigInt(incremented - 1);
  } catch {
    // Fall back to letting viem manage nonces
    return undefined;
  }
}

/**
 * Execute an async operation with retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  actionName: string,
  suggestionId: string,
): Promise<{ success: true; result: T } | { success: false; error: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info(`${actionName} succeeded on retry ${attempt + 1}`, {
          component: "autonomous-executor",
          suggestionId,
        });
      }
      return { success: true, result };
    } catch (err: any) {
      lastError = err;

      const isRetryable =
        err.message?.toLowerCase().includes("nonce") ||
        err.message?.toLowerCase().includes("timeout") ||
        err.message?.toLowerCase().includes("econnrefused") ||
        err.message?.toLowerCase().includes("econnreset") ||
        err.message?.toLowerCase().includes("503") ||
        err.message?.toLowerCase().includes("429") ||
        err.message?.toLowerCase().includes("rate limit") ||
        err.message?.toLowerCase().includes("gas") ||
        err.message?.toLowerCase().includes("replacement") ||
        err.message?.includes("processing") ||
        err.code === "NETWORK_ERROR";

      if (!isRetryable || attempt >= MAX_RETRIES - 1) {
        logger.error(`${actionName} failed permanently after ${attempt + 1} attempts`, {
          component: "autonomous-executor",
          suggestionId,
          attempt: attempt + 1,
        }, err);
        return { success: false, error: err.message || "Unknown error" };
      }

      const delay = backoffDelay(attempt);
      logger.warn(`${actionName} attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
        component: "autonomous-executor",
        suggestionId,
        attempt: attempt + 1,
        error: err.message,
      });

      await sleep(delay);
    }
  }

  return { success: false, error: lastError?.message || "Max retries exceeded" };
}

// ============================================
// Exported Types
// ============================================

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  tokenId?: string;
  explorerUrl?: string;
  error?: string;
  action: ActionType;
  autoApproved: boolean;
  retryCount?: number;
}

// ============================================
// Main Entry Point
// ============================================

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
  const { agentId, userId, actionType, suggestionId } = params;

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

  const signerClient = getSignerClient();
  const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;

  if (!signerClient && !agentPrivateKey) {
    return {
      success: false,
      error: "No signing method available — configure SIGNER_URL+SIGNER_API_KEY or AGENT_PRIVATE_KEY",
      action: actionType,
      autoApproved: true,
    };
  }

  switch (actionType) {
    case "mint": {
      const result = await withRetry(
        () => executeMint(params, signerClient, agentPrivateKey, celoAddress),
        "Mint",
        suggestionId,
      );
      if (!result.success) {
        try {
          await markSuggestionFailed(suggestionId, userId, result.error);
        } catch { /* best effort */ }
        return { success: false, error: result.error, action: actionType, autoApproved: true };
      }
      return result.result;
    }
    case "purchase": {
      const result = await withRetry(
        () => executePurchase(params, signerClient, agentPrivateKey, celoAddress),
        "Purchase",
        suggestionId,
      );
      if (!result.success) {
        try {
          await markSuggestionFailed(suggestionId, userId, result.error);
        } catch { /* best effort */ }
        return { success: false, error: result.error, action: actionType, autoApproved: true };
      }
      return result.result;
    }
    case "tip": {
      const result = await withRetry(
        () => executeTip(params, signerClient, agentPrivateKey, celoAddress),
        "Tip",
        suggestionId,
      );
      if (!result.success) {
        try {
          await markSuggestionFailed(suggestionId, userId, result.error);
        } catch { /* best effort */ }
        return { success: false, error: result.error, action: actionType, autoApproved: true };
      }
      return result.result;
    }
    case "external_search":
      return { success: true, action: actionType, autoApproved: true };
    default:
      return {
        success: false,
        error: `Autonomous execution not yet implemented for action: ${actionType}`,
        action: actionType,
        autoApproved: true,
      };
  }
}

/**
 * Mark a suggestion as failed so the heartbeat can retry it later
 */
async function markSuggestionFailed(
  suggestionId: string,
  userId: string,
  error: string,
): Promise<void> {
  try {
    const { loadSuggestion, persistSuggestion } = await import("./agent-store");
    const suggestion = await loadSuggestion(suggestionId);
    if (suggestion) {
      suggestion.metadata = {
        ...(suggestion.metadata || {}),
        executionError: error,
        failedAt: Date.now(),
        retryCount: ((suggestion.metadata?.retryCount as number) || 0) + 1,
      };
      suggestion.status = "pending"; // Re-open for retry
      await persistSuggestion(suggestion, userId);
    }
  } catch (err) {
    logger.error("Failed to mark suggestion as failed", {
      component: "autonomous-executor",
      suggestionId,
    }, err);
  }
}

// ============================================
// Individual Action Executors
// ============================================

async function executeMint(
  params: any,
  signerClient: SignerClient | null,
  agentPrivateKey: `0x${string}` | undefined,
  agentAddress: string,
): Promise<ExecutionResult> {
  const { userAddress, description, suggestionId } = params;

  const chain = "celo" as const;
  const nftContract = NFT_CONTRACTS[chain];
  if (!nftContract) {
    return { success: false, error: "NFT contract not on Celo", action: "mint", autoApproved: true };
  }

  if (signerClient) {
    const signerResult = await signerClient.signMint({
      chain,
      nftContract: nftContract as string,
      metadataUri: `ipfs://onpoint/autonomous/${suggestionId}`,
      recipients: [
        { address: userAddress as string, percentAllocation: 85 },
        { address: PLATFORM_WALLET as string, percentAllocation: 15 },
      ],
      agentId: params.agentId,
      userId: params.userId,
      suggestionId,
    });

    if (!signerResult.success) {
      return { success: false, error: signerResult.error, action: "mint", autoApproved: true };
    }

    const result = signerResult as { success: true; txHash: string; tokenId: string; explorerUrl: string };

    Metrics.countAction("mint", "succeeded");

    await recordReceipt({
      action: "mint_nft",
      sessionId: suggestionId,
      metadata: { description, tokenId: result.tokenId, userAddress, autoApproved: true },
      txHash: result.txHash,
      chain: "celo",
      onChain: true,
    });

    return {
      success: true,
      txHash: result.txHash,
      tokenId: result.tokenId,
      explorerUrl: result.explorerUrl,
      action: "mint",
      autoApproved: true,
    };
  }

  // Fallback: sign directly with AGENT_PRIVATE_KEY (dev mode)
  if (!agentPrivateKey) {
    return { success: false, error: "No signing method available", action: "mint", autoApproved: true };
  }

  const chainConfig = celo;
  const rpcUrl = "https://forno.celo.org";

  const publicClient = createPublicClient({ chain: chainConfig, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account: agentPrivateKey, chain: chainConfig, transport: http(rpcUrl) });

  const nonce = await getNextNonce(chain, walletClient, agentAddress as Address);
  const splitsClient = createSplitsClient(chainConfig.id, publicClient as any, walletClient as any);

  const metadataUri = `ipfs://onpoint/autonomous/${suggestionId}`;

  const startTime = Date.now();
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
      ...(nonce !== undefined ? { nonce } : {}),
    },
    splitsClient,
  );
  Metrics.recordLatency("mint", Date.now() - startTime);

  AgentControls.recordSpending(params.agentId, params.userId, "mint", parseEther("0.01"));
  Metrics.countAction("mint", "succeeded");

  await recordReceipt({
    action: "mint_nft",
    sessionId: suggestionId,
    metadata: { description, tokenId: result.tokenId, userAddress, autoApproved: true },
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
}

async function executePurchase(
  params: any,
  signerClient: SignerClient | null,
  agentPrivateKey: `0x${string}` | undefined,
  agentAddress: string,
): Promise<ExecutionResult> {
  const { userAddress, amount, description, recipient, suggestionId } = params;

  const chain = "celo" as const;
  const cUSDAddress = ERC20.getCUSDAddress(chain);
  if (!cUSDAddress) {
    return { success: false, error: "cUSD not available on Celo", action: "purchase", autoApproved: true };
  }

  const cleanedAmount = amount.replace(/[^0-9.]/g, "");
  const amountWei = parseEther(cleanedAmount || "0");
  const to = recipient || PLATFORM_WALLET;

  if (signerClient) {
    const signerResult = await signerClient.signTransfer({
      chain,
      tokenAddress: cUSDAddress as string,
      to: to as string,
      amountWei: amountWei.toString(),
      action: "purchase",
      agentId: params.agentId,
      userId: params.userId,
      suggestionId,
      description: description || "Autonomous purchase",
    });

    if (!signerResult.success) {
      return { success: false, error: signerResult.error, action: "purchase", autoApproved: true };
    }

    Metrics.countAction("purchase", "succeeded");

    await recordReceipt({
      action: "propose_mint_nft",
      sessionId: suggestionId,
      metadata: { description, amount, recipient: to, userAddress, autoApproved: true },
      txHash: signerResult.txHash,
      chain: "celo",
      onChain: true,
    });

    return {
      success: true,
      txHash: signerResult.txHash,
      explorerUrl: signerResult.explorerUrl,
      action: "purchase",
      autoApproved: true,
    };
  }

  if (!agentPrivateKey) {
    return { success: false, error: "No signing method available", action: "purchase", autoApproved: true };
  }

  const startTime = Date.now();
  const transferResult = await ERC20.transfer({
    chain,
    tokenAddress: cUSDAddress,
    to: to as Address,
    amount: amountWei,
    privateKey: agentPrivateKey,
  } as any);
  Metrics.recordLatency("purchase", Date.now() - startTime);

  AgentControls.recordSpending(params.agentId, params.userId, "purchase", amountWei);
  Metrics.countAction("purchase", "succeeded");

  await recordReceipt({
    action: "propose_mint_nft",
    sessionId: suggestionId,
    metadata: { description, amount, recipient: to, userAddress, autoApproved: true },
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
}

async function executeTip(
  params: any,
  signerClient: SignerClient | null,
  agentPrivateKey: `0x${string}` | undefined,
  agentAddress: string,
): Promise<ExecutionResult> {
  const { userAddress, amount, description, recipient, suggestionId } = params;

  const chain = "celo" as const;
  const cUSDAddress = ERC20.getCUSDAddress(chain);
  if (!cUSDAddress) {
    return { success: false, error: "cUSD not available on Celo", action: "tip", autoApproved: true };
  }

  const cleanedAmount = amount.replace(/[^0-9.]/g, "");
  const amountWei = parseEther(cleanedAmount || "0");
  const to = recipient || AGENT_WALLET;

  if (signerClient) {
    const signerResult = await signerClient.signTransfer({
      chain,
      tokenAddress: cUSDAddress as string,
      to: to as string,
      amountWei: amountWei.toString(),
      action: "tip",
      agentId: params.agentId,
      userId: params.userId,
      suggestionId,
      description: description || "Autonomous tip",
    });

    if (!signerResult.success) {
      return { success: false, error: signerResult.error, action: "tip", autoApproved: true };
    }

    Metrics.countAction("tip", "succeeded");

    await recordReceipt({
      action: "tip_sent",
      sessionId: suggestionId,
      metadata: { description, amount, recipient: to, userAddress, autoApproved: true },
      txHash: signerResult.txHash,
      chain: "celo",
      onChain: true,
    });

    return {
      success: true,
      txHash: signerResult.txHash,
      explorerUrl: signerResult.explorerUrl,
      action: "tip",
      autoApproved: true,
    };
  }

  if (!agentPrivateKey) {
    return { success: false, error: "No signing method available", action: "tip", autoApproved: true };
  }

  const startTime = Date.now();
  const transferResult = await ERC20.transfer({
    chain,
    tokenAddress: cUSDAddress,
    to: to as Address,
    amount: amountWei,
    privateKey: agentPrivateKey,
  } as any);
  Metrics.recordLatency("tip", Date.now() - startTime);

  AgentControls.recordSpending(params.agentId, params.userId, "tip", amountWei);
  Metrics.countAction("tip", "succeeded");

  await recordReceipt({
    action: "tip_sent",
    sessionId: suggestionId,
    metadata: { description, amount, recipient: to, userAddress, autoApproved: true },
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
}
