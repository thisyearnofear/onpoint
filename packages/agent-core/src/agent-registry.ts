/**
 * Agent Registry Service — ERC-8004 Compliance
 *
 * Records verifiable receipts for agent actions.
 * Redis-backed store + optional on-chain receipt via Celo memo transaction.
 */

import { logger } from "./logger";
import { readPersistentState, writePersistentState } from "./persistent-state";

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
  id: string;
  agentId: number;
  agentAddress: string;
  action: AgentAction;
  sessionId: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  txHash?: string;
  blockNumber?: number;
  chain?: string;
  verifiableLogCid?: string;
  signature?: string;
}

export interface AgentIdentity {
  agentId: number;
  name: string;
  walletAddress: string;
  registryAddress: string;
  registrationTxHash: string;
  receiptCount: number;
  registeredAt: string;
}

// ============================================
// Constants
// ============================================

const AGENT_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

const ONPOINT_AGENT: AgentIdentity = {
  agentId: 9177,
  name: "OnPoint AI Stylist",
  walletAddress:
    process.env.AGENT_WALLET_ADDRESS ||
    "0x5b33E63440e95289207120B94da78CE22F9D24fB",
  registryAddress: AGENT_REGISTRY_ADDRESS,
  registrationTxHash:
    "0x536940e8b9167776a7e2951c9f427ee0a519736f4470cf10065e127b0d14abe3",
  receiptCount: 0,
  registeredAt: "2026-05-25T23:57:00.000Z",
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
    const { createWalletClient, http } = await import("viem");
    const { celo } = await import("viem/chains");

    const client = createWalletClient({
      account: privateKey,
      chain: celo,
      transport: http("https://forno.celo.org"),
    });

    const receiptData = JSON.stringify({
      v: 1,
      id: receipt.id,
      agent: receipt.agentId,
      action: receipt.action,
      session: receipt.sessionId,
      ts: receipt.timestamp,
      meta: receipt.metadata,
    });

    const hash = await client.sendTransaction({
      to: ONPOINT_AGENT.walletAddress as `0x${string}`,
      value: 1n,
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
      { component: "agent-registry", receiptId: receipt.id },
      err,
    );
    return undefined;
  }
}

// ============================================
// Public API
// ============================================

export async function getAgentIdentity(): Promise<AgentIdentity> {
  const receipts = await loadReceipts();
  return { ...ONPOINT_AGENT, receiptCount: receipts.length };
}

export async function recordReceipt(params: {
  action: AgentAction;
  sessionId: string;
  metadata?: Record<string, unknown>;
  txHash?: string;
  blockNumber?: number;
  chain?: string;
  onChain?: boolean;
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

  // Create Verifiable Agent Log (IPFS)
  try {
    const { uploadToIPFS } = await import("@repo/ipfs-client");
    const { getAgentWallet } = await import("./agent-wallet");

    const logData = JSON.stringify(receipt);
    const wallet = await getAgentWallet();
    const signature = await wallet.signMessage(logData);
    receipt.signature = signature;

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
      { component: "agent-registry", receiptId: receipt.id },
      err,
    );
  }

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

export async function getSessionReceipts(
  sessionId: string,
): Promise<AgentReceipt[]> {
  const receipts = await loadReceipts();
  return receipts
    .filter((r) => r.sessionId === sessionId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

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

export async function getReceipt(
  id: string,
): Promise<AgentReceipt | undefined> {
  const receipts = await loadReceipts();
  return receipts.find((receipt) => receipt.id === id);
}

export async function getOnChainReceipts(): Promise<AgentReceipt[]> {
  const receipts = await loadReceipts();
  return receipts
    .filter((r) => r.txHash)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function generateReceiptVerifiableData(receipt: AgentReceipt): {
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  types: { AgentReceipt: { name: string; type: string }[] };
  message: Record<string, unknown>;
} {
  return {
    domain: {
      name: "OnPoint Agent Registry",
      version: "1",
      chainId: 8453,
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
