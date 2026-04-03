/**
 * Agent Mint API
 *
 * Allows the AI Agent to mint NFTs on behalf of users.
 * Uses @repo/blockchain-client for NFT minting with 0xSplits.
 * Uses Tether WDK to resolve the agent's self-custodial wallet.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
} from "../../../../lib/middleware/agent-controls";
import { corsHeaders } from "../../ai/_utils/http";
import {
  celoSepolia,
  NFT_CONTRACTS,
  PLATFORM_WALLET,
  getExplorerUrl,
  type ChainName,
} from "../../../../config/chains";
import { getAgentWallet } from "../../../../lib/services/agent-wallet";
import { mintNFTWithSplit, createSplitsClient } from "@repo/blockchain-client";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import { logger } from "../../../../lib/utils/logger";

// Request validation
const MintRequestSchema = z.object({
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address"),
  metadataUri: z.string().min(1, "metadataUri is required"),
  royaltyRecipient: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address")
    .optional(),
  royaltyBps: z.number().min(0).max(10000).default(500).optional(),
  chain: z.enum(["celo", "celoSepolia"]).default("celo"),
  agentId: z.string().default("onpoint-stylist"),
  approvalId: z.string().optional(),
});

// Response types
interface MintResponse {
  success: boolean;
  mint?: {
    hash: string;
    tokenId: string;
    chain: string;
    explorerUrl: string;
    splitAddress?: string;
  };
  approvalRequired?: boolean;
  approvalRequest?: {
    id: string;
    amount: string;
    description: string;
    expiresAt: number;
  };
  error?: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<MintResponse>> {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      // Parse and validate request
      const body = await req.json();
      const parsed = MintRequestSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: parsed.error.message },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const {
        userAddress,
        metadataUri,
        royaltyRecipient,
        royaltyBps = 500,
        chain,
        agentId,
        approvalId,
      } = parsed.data;

      await AgentControls.initStore(agentId);

      // Check if NFT contract exists on this chain
      const nftContract = NFT_CONTRACTS[chain];
      if (!nftContract) {
        return NextResponse.json(
          { success: false, error: `NFT contract not deployed on ${chain}` },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      // Estimate mint cost (gas estimation - roughly 0.01 CELO)
      const estimatedGasWei = parseEther("0.01");
      const royaltyAddr = royaltyRecipient || userAddress;

      // Validate against spending limits
      const validation = AgentControls.validateAction({
        agentId,
        actionType: "mint" as ActionType,
        amount: estimatedGasWei,
        amountFormatted: "~0.01 CELO (gas)",
        description: `Mint NFT for ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`,
        recipient: userAddress,
      });

      // If approval is required, return approval request
      if (validation.requiresApproval) {
        return NextResponse.json(
          {
            success: false,
            approvalRequired: true,
            approvalRequest: validation.approvalRequest
              ? {
                  id: validation.approvalRequest.id,
                  amount: validation.approvalRequest.amount,
                  description: validation.approvalRequest.description,
                  expiresAt: validation.approvalRequest.expiresAt,
                }
              : undefined,
          },
          { status: 402, headers: corsHeaders(origin) },
        );
      }

      // If not allowed, return error
      if (!validation.allowed) {
        return NextResponse.json(
          { success: false, error: validation.reason || "Action not allowed" },
          { status: 403, headers: corsHeaders(origin) },
        );
      }

      // Check for pre-approval
      if (approvalId) {
        const approval = AgentControls.getApprovalRequest(approvalId);
        if (!approval || approval.status !== "approved") {
          return NextResponse.json(
            { success: false, error: "Invalid or expired approval" },
            { status: 403, headers: corsHeaders(origin) },
          );
        }
      }

      // Resolve agent wallet via WDK
      let agentWdkAddress: string | null = null;
      try {
        const wallet = await getAgentWallet();
        const addresses = await wallet.getAddresses();
        agentWdkAddress =
          addresses[chain] ??
          addresses.celo ??
          Object.values(addresses)[0] ??
          null;
        if (agentWdkAddress) {
          logger.info("WDK agent address resolved", {
            component: "mint",
            chain,
            agentWdkAddress,
          });
        }
      } catch (wdkErr) {
        logger.warn("WDK not available", { component: "mint" }, wdkErr);
      }

      // Get agent private key from environment
      const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as
        | `0x${string}`
        | undefined;

      if (!agentPrivateKey) {
        // Production: signing required for real on-chain receipts
        logger.error("AGENT_PRIVATE_KEY not configured", { component: "mint" });

        return NextResponse.json(
          {
            success: false,
            error:
              "Agent signing not configured. Set AGENT_PRIVATE_KEY to enable real NFT minting with on-chain receipts.",
            code: "SIGNING_NOT_CONFIGURED",
          },
          { status: 503, headers: corsHeaders(origin) },
        );
      }

      // Production: mint via @repo/blockchain-client
      const chainConfig = chain === "celoSepolia" ? celoSepolia : celo;
      const rpcUrl =
        chain === "celoSepolia"
          ? "https://celo-sepolia.g.alchemy.com/v2/W73tCsyRsW9JfV4orIbr7"
          : "https://forno.celo.org";

      const publicClient = createPublicClient({
        chain: chainConfig,
        transport: http(rpcUrl),
      });

      const walletClient = createWalletClient({
        account: agentPrivateKey,
        chain: chainConfig,
        transport: http(rpcUrl),
      });

      const splitsClient = createSplitsClient(
        chainConfig.id,
        publicClient as any,
        walletClient as any,
      );

      const result = await mintNFTWithSplit(
        walletClient as any,
        publicClient as any,
        nftContract as Address,
        metadataUri,
        {
          recipients: [
            { address: royaltyAddr as Address, percentAllocation: 85 },
            { address: PLATFORM_WALLET as Address, percentAllocation: 15 },
          ],
        },
        splitsClient,
      );

      // Record the spending
      AgentControls.recordSpending(
        agentId,
        "mint" as ActionType,
        estimatedGasWei,
      );

      return NextResponse.json(
        {
          success: true,
          mint: {
            hash: result.transactionHash,
            tokenId: result.tokenId,
            chain,
            explorerUrl: getExplorerUrl(
              chain as ChainName,
              result.transactionHash,
            ),
            splitAddress: result.splitAddress,
          },
        },
        { status: 200, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.apiError("/api/agent/mint", "Mint API error", error);
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get("origin") ?? undefined),
  });
}
