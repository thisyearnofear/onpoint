/**
 * Agent Purchase API
 *
 * Allows the AI Agent to execute purchases on behalf of users.
 * Uses viem directly for ERC-20 payments (cUSD).
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type Address, parseEther } from "viem";
import {
  AgentControls,
  type ActionType,
} from "../../../../lib/middleware/agent-controls";
import {
  ERC20,
  getExplorerUrl,
  type TokenTransferResult,
} from "../../../../lib/utils/erc20";
import { CANVAS_ITEMS } from "@onpoint/shared-types";

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

// Platform fee wallet (receives 15%)
const PLATFORM_WALLET = "0x05f012C12123D69E8324A251ae7D15A92C4549c1" as Address;

// Product catalog - maps CANVAS_ITEMS to purchase-ready format
const PRODUCTS: Record<
  string,
  {
    id: string;
    name: string;
    price: string; // in cUSD (human-readable)
    seller: Address;
    category: string;
  }
> = Object.fromEntries(
  CANVAS_ITEMS.map((item) => [
    item.slug,
    {
      id: item.slug,
      name: item.name,
      price: item.price.toString(),
      seller: PLATFORM_WALLET,
      category: item.category,
    },
  ]),
);

// Request validation
const PurchaseRequestSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1).max(10),
  chain: z.enum(["celo", "celoAlfajores", "base"]).default("celo"),
  agentId: z.string().default("onpoint-stylist"),
  approvalId: z.string().optional(),
  affiliateId: z.string().optional(),
});

// Response types
interface PurchaseResponse {
  success: boolean;
  purchase?: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    totalAmount: string;
    txHash: string;
    chain: string;
    explorerUrl: string;
    timestamp: number;
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
): Promise<NextResponse<PurchaseResponse>> {
  const origin = request.headers.get("origin");

  try {
    // Parse and validate request
    const body = await request.json();
    const parsed = PurchaseRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const { productId, quantity, chain, agentId, approvalId } = parsed.data;

    // Get product from catalog
    const product = PRODUCTS[productId.toLowerCase()];
    if (!product) {
      return NextResponse.json(
        { success: false, error: `Product not found: ${productId}` },
        { status: 404, headers: corsHeaders(origin) },
      );
    }

    // Check if cUSD is available on this chain
    const cUSDAddress = ERC20.getCUSDAddress(chain);
    if (!cUSDAddress) {
      return NextResponse.json(
        { success: false, error: `cUSD not available on ${chain}` },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    // Calculate total amount
    const unitPriceWei = parseEther(product.price);
    const totalAmountWei = unitPriceWei * BigInt(quantity);
    const totalFormatted = `${parseFloat(product.price) * quantity} cUSD`;

    // Validate against spending limits
    const validation = AgentControls.validateAction({
      agentId,
      actionType: "purchase" as ActionType,
      amount: totalAmountWei,
      amountFormatted: totalFormatted,
      description: `Purchase ${quantity}x ${product.name}`,
      recipient: product.seller,
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

    // Get agent private key from environment
    // In production, use AWS KMS or similar
    const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as
      | `0x${string}`
      | undefined;
    if (!agentPrivateKey) {
      // For demo: return success without actual transfer
      console.log(
        "[Purchase API] No AGENT_PRIVATE_KEY set, simulating transfer",
      );

      const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      return NextResponse.json(
        {
          success: true,
          purchase: {
            id: purchaseId,
            productId: product.id,
            productName: product.name,
            quantity,
            totalAmount: totalFormatted,
            txHash: "0x" + "0".repeat(64), // Simulated
            chain,
            explorerUrl: `https://celoscan.io`,
            timestamp: Date.now(),
          },
        },
        { status: 200, headers: corsHeaders(origin) },
      );
    }

    // Execute the cUSD transfer
    const transferResult: TokenTransferResult = await ERC20.transfer({
      chain,
      tokenAddress: cUSDAddress,
      to: product.seller,
      amount: totalAmountWei,
      privateKey: agentPrivateKey,
    });

    // Record the spending
    AgentControls.recordSpending(
      agentId,
      "purchase" as ActionType,
      totalAmountWei,
    );

    // Generate purchase ID
    const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Return success
    return NextResponse.json(
      {
        success: true,
        purchase: {
          id: purchaseId,
          productId: product.id,
          productName: product.name,
          quantity,
          totalAmount: `${transferResult.amount} ${transferResult.symbol}`,
          txHash: transferResult.hash,
          chain,
          explorerUrl: getExplorerUrl(chain, transferResult.hash),
          timestamp: Date.now(),
        },
      },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Purchase API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// GET endpoint to list available products
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const category = url.searchParams.get("category");

  let products = Object.values(PRODUCTS);

  if (category) {
    products = products.filter((p) => p.category === category);
  }

  return NextResponse.json(
    { products },
    { status: 200, headers: corsHeaders(origin) },
  );
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get("origin")),
  });
}
