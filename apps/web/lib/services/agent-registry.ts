/**
 * Agent Registry Service — ERC-8004 Compliance
 *
 * Records verifiable receipts for agent actions.
 * In-memory store + optional on-chain receipt via Celo memo transaction.
 *
 * Each receipt includes: agent identity, action type, timestamp,
 * metadata, and optional on-chain transaction hash.
 *
 * ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
 */

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
    "0x2C4FAa0Bbb141344829978B1E697b29756795991",
  registryAddress: AGENT_REGISTRY_ADDRESS,
  registrationTxHash:
    "0x04034211a79a65c701d1362359dace27b4f5f0588b515bb344c2331f77f1e555",
  receiptCount: 0,
  registeredAt: "2026-03-23T07:11:35.978Z",
};

// ============================================
// In-Memory Receipt Store
// ============================================

const receiptStore = new Map<string, AgentReceipt>();

function generateReceiptId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `receipt_${timestamp}_${random}`;
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
    console.log(
      "[AgentRegistry] No AGENT_PRIVATE_KEY — skipping on-chain receipt",
    );
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

    console.log(`[AgentRegistry] On-chain receipt: ${hash}`);
    return hash;
  } catch (err: any) {
    console.error(
      "[AgentRegistry] On-chain receipt failed:",
      err?.message || err,
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
export function getAgentIdentity(): AgentIdentity {
  return {
    ...ONPOINT_AGENT,
    receiptCount: receiptStore.size,
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

  receiptStore.set(receipt.id, receipt);

  // Optionally record on-chain
  if (params.onChain && !params.txHash) {
    const chainTxHash = await recordReceiptOnChain(receipt);
    if (chainTxHash) {
      receipt.txHash = chainTxHash;
      receipt.chain = "celo";
      receiptStore.set(receipt.id, receipt);
    }
  }

  console.log(
    `[AgentRegistry] Receipt: ${receipt.id} | ${receipt.action} | Agent #${receipt.agentId}${receipt.txHash ? ` | tx: ${receipt.txHash}` : ""}`,
  );

  return receipt;
}

/**
 * Get all receipts for a session
 */
export function getSessionReceipts(sessionId: string): AgentReceipt[] {
  return Array.from(receiptStore.values())
    .filter((r) => r.sessionId === sessionId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Get all receipts (paginated)
 */
export function getAllReceipts(options?: {
  limit?: number;
  offset?: number;
  action?: AgentAction;
}): { receipts: AgentReceipt[]; total: number } {
  let receipts = Array.from(receiptStore.values());

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
export function getReceipt(id: string): AgentReceipt | undefined {
  return receiptStore.get(id);
}

/**
 * Get receipts with on-chain verification (have txHash)
 */
export function getOnChainReceipts(): AgentReceipt[] {
  return Array.from(receiptStore.values())
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

// ============================================
// Seed with initial registration receipt
// ============================================

recordReceipt({
  action: "analyze_outfit", // placeholder for registration
  sessionId: "registration",
  metadata: {
    type: "agent_registered",
    agentId: 35962,
    name: "OnPoint AI Stylist",
    registry: "ERC-8004",
    chain: "base",
    hackathon: "synthesis-2026",
  },
  txHash: "0x04034211a79a65c701d1362359dace27b4f5f0588b515bb344c2331f77f1e555",
  chain: "base",
});
