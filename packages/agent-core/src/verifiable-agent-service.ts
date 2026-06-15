/**
 * Verifiable Agent Service
 *
 * Provides a verifiable audit trail of agent decisions, signed by the agent
 * and stored on decentralized infrastructure (IPFS/Filecoin).
 *
 * For the Protocol Labs Genesis Hackathon — Frontiers of Collaboration
 */

import { uploadToIPFS } from "@repo/ipfs-client";
import { getAgentWallet } from "./agent-wallet";
import type { ActionType, AgentSuggestion } from "./agent-controls";

/**
 * TEE (Trusted Execution Environment) proof carried on a receipt
 * when the underlying inference was routed through a verifiable
 * compute provider (currently 0G Compute).
 *
 * The shape is the slice of `x_0g_trace` that 0G Router returns,
 * normalized to match the rest of our receipt schema.
 *
 * Reference: https://docs.0g.ai/developer-hub/building-on-0g/compute-network
 */
export interface TEEAttestation {
  /** On-chain provider address (0x...) that handled the request. */
  provider: string;
  /** 0G's request UUID — useful for cross-referencing the TEE trace. */
  requestId: string;
  /** Verification mode declared by the provider. */
  mode: "TeeML" | "TeeTLS";
  /** Attestation type — currently always TDX / dstack on live catalog. */
  teeType: "TDX";
  /** Verifier — currently always dstack on the live 0G catalog. */
  verifier: "dstack";
  /** Unix ms when the agent layer received the TEE proof. */
  verifiedAt: number;
  /** Optional cost in 0G base units (1e-10 0G) for billing reconciliation. */
  billing?: {
    inputCost?: string;
    outputCost?: string;
    totalCost?: string;
  };
}

export interface AgentReceipt {
  version: string;
  agentId: string;
  userId: string;
  action: {
    type: ActionType;
    amount: string;
    description: string;
    recipient?: string;
  };
  context: {
    modelId: string;
    timestamp: number;
    suggestionId: string;
    metadata?: Record<string, any>;
  };
  attestation: {
    signer: string;
    signature?: string;
    /**
     * Optional TEE proof when the inference was routed through a
     * verifiable compute provider. Two attestations on the receipt
     * (our signer + the TEE provider) is the auditability claim —
     * the agent signature proves we acted, the TEE proof proves the
     * underlying inference was actually executed by the claimed model.
     */
    tee?: TEEAttestation;
  };
}

export interface CreateVerifiableLogOptions {
  /**
   * Optional TEE proof to attach to the receipt. Pass the normalized
   * object — typically derived from `x_0g_trace` on the 0G Router
   * response — and it is stamped under `attestation.tee` so the
   * resulting IPFS-pinned receipt carries both attestations
   * (agent signer + TEE provider).
   */
  tee?: Omit<TEEAttestation, "verifiedAt">;
}

export class VerifiableAgentService {
  static async createVerifiableLog(
    suggestion: AgentSuggestion,
    userId: string,
    modelId: string = "venice-mistral-31-24b",
    options: CreateVerifiableLogOptions = {},
  ): Promise<{ cid: string; signature: string }> {
    const wallet = await getAgentWallet();
    const addresses = await wallet.getAddresses();

    const signerAddress =
      addresses.celo || Object.values(addresses)[0] || "";

    // Build the TEE attestation block if a proof was provided.
    // TEE proofs are auto-stamped with the time the agent layer
    // received them so the audit trail is reproducible.
    const teeAttestation: TEEAttestation | undefined = options.tee
      ? {
          ...options.tee,
          verifiedAt: Date.now(),
        }
      : undefined;

    const receipt: AgentReceipt = {
      version: "1.0.0",
      agentId: suggestion.agentId,
      userId,
      action: {
        type: suggestion.actionType,
        amount: suggestion.amount,
        description: suggestion.description,
        recipient: suggestion.recipient,
      },
      context: {
        modelId,
        timestamp: suggestion.createdAt || Date.now(),
        suggestionId: suggestion.id,
        metadata: suggestion.metadata,
      },
      attestation: {
        signer: signerAddress,
        // TEE proof is included BEFORE signing so the agent's signature
        // commits to both attestations. Removing or tampering with the
        // TEE block invalidates the signature.
        tee: teeAttestation,
      },
    };

    try {
      const logString = JSON.stringify(receipt);
      const signature = await wallet.signMessage(logString);

      receipt.attestation.signature = signature;

      const uploadResult = await uploadToIPFS(
        JSON.stringify(receipt, null, 2),
        `agent-receipt-${suggestion.id}.json`,
      );

      console.log(
        `[VerifiableAgent] Log created: ${uploadResult.cid}` +
          (teeAttestation
            ? ` (TEE verified by ${teeAttestation.provider})`
            : ""),
      );

      return {
        cid: uploadResult.cid,
        signature,
      };
    } catch (err) {
      console.error("[VerifiableAgent] Failed to create verifiable log:", err);
      throw err;
    }
  }

  static async verifyReceipt(receipt: AgentReceipt): Promise<boolean> {
    if (!receipt.attestation.signature) return false;

    try {
      const { verifyMessage } = await import("viem");

      const { signature, ...attestationWithoutSignature } = receipt.attestation;
      const receiptToVerify = {
        ...receipt,
        attestation: attestationWithoutSignature,
      };

      const message = JSON.stringify(receiptToVerify);

      return await verifyMessage({
        address: receipt.attestation.signer as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (err) {
      console.error("[VerifiableAgent] Verification failed:", err);
      return false;
    }
  }
}
