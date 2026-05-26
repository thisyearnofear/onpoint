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
  };
}

export class VerifiableAgentService {
  static async createVerifiableLog(
    suggestion: AgentSuggestion,
    userId: string,
    modelId: string = "venice-mistral-31-24b",
  ): Promise<{ cid: string; signature: string }> {
    const wallet = await getAgentWallet();
    const addresses = await wallet.getAddresses();

    const signerAddress =
      addresses.celo || Object.values(addresses)[0] || "";

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

      console.log(`[VerifiableAgent] Log created: ${uploadResult.cid}`);

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
