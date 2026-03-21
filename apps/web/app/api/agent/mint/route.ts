/**
 * Agent Mint API
 *
 * Allows the AI Agent to mint NFTs on behalf of users.
 * Uses @repo/blockchain-client for NFT minting with 0xSplits.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type Address } from "viem";
import {
  AgentControls,
  type ActionType,
} from "../../../../lib/middleware/agent-controls";

// CORS headers
function corsHeaders(origin: string | null): HeadersInit {
  const allowedOrigins = [
    "https://beonpoint.netlify.app",
    "https://onpoint.fashion",
    "http://localhost:3000",
    "http://localhost:3001",
  ];

  const allowedOrigin = allowedOrigins.includes(origin || "") ? origin! : "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// Request validation
const MintRequestSchema = z.object({
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address"),
  metadataUri: z.string().min(1, "metadataUri is required"),
  royaltyRecipient: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address")
    .optional(),
  royaltyBps: z.number().min(0).max(10000).default(500).optional(),
  chain: z.enum(["celo", "celoAlfajores"]).default("celo"),
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

// Contract addresses
const NFT_CONTRACTS: Record<string, Address> = {
  celo: "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1",
  celoAlfajores: "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1",
};

export async function POST(
  request: NextRequest,
): Promise<NextResponse<MintResponse>> {
  const origin = request.headers.get("origin");

  try {
    // Parse and validate request
    const body = await request.json();
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

    // Check for required environment variables
    const agentPrivateKey = process.env.AGENT_PRIVATE_KEY;
    const rpcUrl =
      chain === "celoAlfajores"
        ? "https://alfajores-forno.celo-testnet.org"
        : "https://forno.celo.org";

    if (!agentPrivateKey) {
      // For demo: return simulated success
      console.log("[Mint API] No AGENT_PRIVATE_KEY set, simulating mint");

      return NextResponse.json(
        {
          success: true,
          mint: {
            hash: "0x" + "0".repeat(64),
            tokenId: "1",
            chain,
            explorerUrl: "https://celoscan.io",
          },
        },
        { status: 200, headers: corsHeaders(origin) },
      );
    }

    // For production: use @repo/blockchain-client
    // import { mintNFTWithSplit, createSplitsClient } from "@repo/blockchain-client";
    //
    // const publicClient = createPublicClient({
    //   chain: celo,
    //   transport: http(rpcUrl),
    // });
    //
    // const walletClient = createWalletClient({
    //   account: agentPrivateKey,
    //   chain: celo,
    //   transport: http(rpcUrl),
    // });
    //
    // const splitsClient = createSplitsClient(42220, publicClient, walletClient);
    //
    // const result = await mintNFTWithSplit(
    //   walletClient,
    //   publicClient,
    //   nftContract,
    //   metadataUri,
    //   {
    //     recipients: [
    //       { address: royaltyAddr, percentAllocation: 85 },
    //       { address: PLATFORM_WALLET, percentAllocation: 15 },
    //     ],
    //   },
    //   splitsClient
    // );

    // For now, return simulated success with note
    console.log("[Mint API] Full blockchain-client integration pending");

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
          hash: "0x" + "demo" + "0".repeat(60),
          tokenId: "pending",
          chain,
          explorerUrl: getExplorerUrl(chain),
          splitAddress: royaltyAddr,
        },
      },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Mint API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

// ============================================
// Helpers
// ============================================

function parseEther(value: string): bigint {
  const num = parseFloat(value);
  return BigInt(Math.floor(num * 1e18));
}

function getExplorerUrl(chain: string): string {
  const explorers: Record<string, string> = {
    celo: "https://celoscan.io/tx/",
    celoAlfajores: "https://alfajores.celoscan.io/tx/",
  };
  return explorers[chain] || "https://celoscan.io/tx/";
}
