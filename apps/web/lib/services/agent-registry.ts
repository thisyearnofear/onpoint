/**
 * Agent Registry Service — ERC-8004 Compliance
 *
 * Records verifiable receipts for agent actions.
 * Redis-backed store + optional on-chain receipt via Celo memo transaction.
 *
 * Each receipt includes: agent identity, action type, timestamp,
 * metadata, and optional on-chain transaction hash.
 *
 * ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
 */

import { logger } from "../utils/logger";
import {
  readPersistentState,
  writePersistentState,
} from "../utils/persistent-state";

// ============================================
// Types
// ============================================

export type AgentAction =
  | "analyze_outfit"
  | "recommend_product"
  | "propose_mint_nft"
  | "mint_nft"
  | "check_wallet_balance"
  | "track_style_preference"
  | "tip_received"
  | "tip_sent"
  | "privacy_audit"
  | "auto_tip";

export interface AgentReceipt {
  /** Unique receipt ID */
  id: string;
  /** ERC-8004 agent ID (e.g., 35962) */
  agentId: number;
  /** Agent wallet address */
  agentAddress: string;
  /** Action performed */
  action: AgentAction;
  /** Session ID for grouping */
  sessionId: string;
  /** ISO timestamp */
  timestamp: string;
  /** Action-specific metadata */
  metadata: Record<string, unknown>;
  /** On-chain transaction hash (if applicable) */
  txHash?: string;
  /** Block number (if on-chain) */
  blockNumber?: number;
  /** Chain where transaction occurred */
  chain?: string;
  /** Verifiable log CID (IPFS/Filecoin) - Hackathon Frontier Feature */
  verifiableLogCid?: string;
  /** Agent signature of the receipt data */
  signature?: string;
}

export interface AgentIdentity {
  /** ERC-8004 agent ID */
  agentId: number;
  /** Agent name */
  name: string;
  /** Agent wallet address */
  walletAddress: string;
  /** Agent registry contract on Base */
  registryAddress: string;
  /** Registration transaction hash */
  registrationTxHash: string;
  /** Total receipts recorded */
  receiptCount: number;
  /** Registration timestamp */
  registeredAt: string;
}

// ============================================
// Constants
// ============================================

/** ERC-8004 Agent Registry on Base */
const AGENT_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

/** Our agent's identity */
const ONPOINT_AGENT: AgentIdentity = {
  agentId: 35962,
  name: "OnPoint AI Stylist",
  walletAddress:
    process.env.AGENT_WALLET_ADDRESS ||
    "0xC9A025Fb607b455308bCb6f35a0F484f016C776b",
  registryAddress: AGENT_REGISTRY_ADDRESS,
  registrationTxHash:
    "0x04034211a79a65c701d1362359dace27b4f5f0588b515bb344c2331f77f1e555",
  receiptCount: 0,
  registeredAt: "2026-03-23T07:11:35.978Z",
};

const RECEIPTS_KEY = "agent:receipts:v1";

function generateReceiptId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `receipt_${timestamp}_${random}`;
}

async function loadReceipts(): Promise<AgentReceipt[]> {
  return readPersistentState(RECEIPTS_KEY, () => []);
}

async function saveReceipts(receipts: AgentReceipt[]): Promise<void> {
  await writePersistentState(RECEIPTS_KEY, receipts);
}

async function upsertReceipt(receipt: AgentReceipt): Promise<void> {
  const receipts = await loadReceipts();
  const existingIndex = receipts.findIndex((entry) => entry.id === receipt.id);

  if (existingIndex >= 0) {
    receipts[existingIndex] = receipt;
  } else {
    receipts.push(receipt);
  }

  await saveReceipts(receipts);
}

// ============================================
// On-Chain Receipt (Celo)
// ============================================

/**
 * Record a receipt on-chain via a Celo memo transaction.
 *
 * Sends a minimal CELO transfer (1 wei) to the agent's own address
 * with the receipt data encoded as the transaction `data` field.
 * This creates a verifiable, timestamped on-chain record.
 */
async function recordReceiptOnChain(
  receipt: AgentReceipt,
): Promise<string | undefined> {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    logger.info("Skipping on-chain receipt; AGENT_PRIVATE_KEY missing", {
      component: "agent-registry",
      receiptId: receipt.id,
    });
    return undefined;
  }

  try {
    const { createWalletClient, http, encodeFunctionData } = await import(
      "viem"
    );
    const { celo } = await import("viem/chains");

    const client = createWalletClient({
      account: privateKey,
      chain: celo,
      transport: http("https://forno.celo.org"),
    });

    // Encode receipt as JSON for the data field
    const receiptData = JSON.stringify({
      v: 1, // schema version
      id: receipt.id,
      agent: receipt.agentId,
      action: receipt.action,
      session: receipt.sessionId,
      ts: receipt.timestamp,
      meta: receipt.metadata,
    });

    // Send minimal CELO to self with receipt as data
    const hash = await client.sendTransaction({
      to: ONPOINT_AGENT.walletAddress as `0x${string}`,
      value: 1n, // 1 wei — minimal cost
      data: `0x${Buffer.from(receiptData).toString("hex")}`,
    });

    logger.info("Recorded on-chain receipt", {
      component: "agent-registry",
      receiptId: receipt.id,
      txHash: hash,
    });
    return hash;
  } catch (err: any) {
    logger.error(
      "Failed to record on-chain receipt",
      {
        component: "agent-registry",
        receiptId: receipt.id,
      },
      err,
    );
    return undefined;
  }
}

// ============================================
// Public API
// ============================================

/**
 * Get the OnPoint agent's ERC-8004 identity
 */
export async function getAgentIdentity(): Promise<AgentIdentity> {
  const receipts = await loadReceipts();
  return {
    ...ONPOINT_AGENT,
    receiptCount: receipts.length,
  };
}

/**
 * Record a new agent receipt.
 * Optionally writes to Celo on-chain for verifiable receipts.
 */
export async function recordReceipt(params: {
  action: AgentAction;
  sessionId: string;
  metadata?: Record<string, unknown>;
  txHash?: string;
  blockNumber?: number;
  chain?: string;
  onChain?: boolean; // If true, also write to Celo
}): Promise<AgentReceipt> {
  const receipt: AgentReceipt = {
    id: generateReceiptId(),
    agentId: ONPOINT_AGENT.agentId,
    agentAddress: ONPOINT_AGENT.walletAddress,
    action: params.action,
    sessionId: params.sessionId,
    timestamp: new Date().toISOString(),
    metadata: params.metadata || {},
    txHash: params.txHash,
    blockNumber: params.blockNumber,
    chain: params.chain,
  };

  await upsertReceipt(receipt);

  // HACKATHON: Create Verifiable Agent Log (IPFS/Filecoin - Frontiers of Collaboration)
  // This provides a tamper-proof audit trail of agent decisions, signed by the agent wallet.
  try {
    const { uploadToIPFS } = await import("@repo/ipfs-client");
    const { getAgentWallet } = await import("./agent-wallet");

    // 1. Prepare log data (copy of receipt before CID/signature)
    const logData = JSON.stringify(receipt);

    // 2. Sign the log data using the agent's self-custodial wallet
    const wallet = await getAgentWallet();
    const signature = await wallet.signMessage(logData);
    receipt.signature = signature;

    // 3. Upload full signed receipt to IPFS (Filecoin-backed)
    const signedReceipt = { ...receipt, signature };
    const uploadResult = await uploadToIPFS(
      JSON.stringify(signedReceipt, null, 2),
      `agent-receipt-${receipt.id}.json`,
    );

    receipt.verifiableLogCid = uploadResult.cid;
    await upsertReceipt(receipt);

    logger.info("Created verifiable receipt log", {
      component: "agent-registry",
      receiptId: receipt.id,
      cid: uploadResult.cid,
    });
  } catch (err) {
    logger.warn(
      "Failed to create verifiable receipt log",
      {
        component: "agent-registry",
        receiptId: receipt.id,
      },
      err,
    );
    // Continue - don't fail the action if IPFS/Signing is down
  }

  // Optionally record on-chain (Celo memo)
  if (params.onChain && !params.txHash) {
    const chainTxHash = await recordReceiptOnChain(receipt);
    if (chainTxHash) {
      receipt.txHash = chainTxHash;
      receipt.chain = "celo";
      await upsertReceipt(receipt);
    }
  }

  logger.info("Recorded agent receipt", {
    component: "agent-registry",
    receiptId: receipt.id,
    action: receipt.action,
    agentId: String(receipt.agentId),
    txHash: receipt.txHash,
  });

  return receipt;
}

/**
 * Get all receipts for a session
 */
export async function getSessionReceipts(
  sessionId: string,
): Promise<AgentReceipt[]> {
  const receipts = await loadReceipts();
  return receipts
    .filter((r) => r.sessionId === sessionId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Get all receipts (paginated)
 */
export async function getAllReceipts(options?: {
  limit?: number;
  offset?: number;
  action?: AgentAction;
}): Promise<{ receipts: AgentReceipt[]; total: number }> {
  let receipts = await loadReceipts();

  if (options?.action) {
    receipts = receipts.filter((r) => r.action === options.action);
  }

  receipts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total = receipts.length;
  const offset = options?.offset || 0;
  const limit = options?.limit || 50;

  return {
    receipts: receipts.slice(offset, offset + limit),
    total,
  };
}

/**
 * Get receipt by ID
 */
export async function getReceipt(id: string): Promise<AgentReceipt | undefined> {
  const receipts = await loadReceipts();
  return receipts.find((receipt) => receipt.id === id);
}

/**
 * Get receipts with on-chain verification (have txHash)
 */
export async function getOnChainReceipts(): Promise<AgentReceipt[]> {
  const receipts = await loadReceipts();
  return receipts
    .filter((r) => r.txHash)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Generate an ERC-8004 compatible receipt summary for verification
 */
export function generateReceiptVerifiableData(receipt: AgentReceipt): {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: { AgentReceipt: { name: string; type: string }[] };
  message: Record<string, unknown>;
} {
  return {
    domain: {
      name: "OnPoint Agent Registry",
      version: "1",
      chainId: 8453, // Base
      verifyingContract: AGENT_REGISTRY_ADDRESS,
    },
    types: {
      AgentReceipt: [
        { name: "agentId", type: "uint256" },
        { name: "action", type: "string" },
        { name: "sessionId", type: "string" },
        { name: "timestamp", type: "string" },
        { name: "metadata", type: "string" },
      ],
    },
    message: {
      agentId: receipt.agentId,
      action: receipt.action,
      sessionId: receipt.sessionId,
      timestamp: receipt.timestamp,
      metadata: JSON.stringify(receipt.metadata),
    },
  };
}
