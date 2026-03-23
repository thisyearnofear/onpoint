/**
 * Agent Purchase API
 *
 * Allows the AI Agent to execute purchases on behalf of users.
 * Uses Tether WDK to resolve the agent's self-custodial wallet address.
 * ERC-20 transfers (cUSD/USDT) use viem for ABI encoding.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseEther, type Address } from "viem";
import {
  AgentControls,
  type ActionType,
} from "../../../../lib/middleware/agent-controls";
import { ERC20, type TokenTransferResult } from "../../../../lib/utils/erc20";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import { corsHeaders } from "../../ai/_utils/http";
import { PLATFORM_WALLET, getExplorerUrl } from "../../../../config/chains";
import { getAgentWallet } from "../../../../lib/services/agent-wallet";

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
  chain: z.enum(["celo", "celoSepolia", "base"]).default("celo"),
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
  const origin = request.headers.get("origin") ?? undefined;

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

    await AgentControls.initStore(agentId);

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
        console.log(
          `[Purchase API] WDK agent address (${chain}): ${agentWdkAddress}`,
        );
      }
    } catch (wdkErr) {
      console.warn("[Purchase API] WDK not available:", wdkErr);
    }

    // Get agent private key from environment
    const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as
      | `0x${string}`
      | undefined;

    if (!agentPrivateKey) {
      // Production: signing required for real on-chain receipts
      console.error("[Purchase API] AGENT_PRIVATE_KEY not configured");

      return NextResponse.json(
        {
          success: false,
          error:
            "Agent signing not configured. Set AGENT_PRIVATE_KEY to enable real purchases with on-chain receipts.",
          code: "SIGNING_NOT_CONFIGURED",
        },
        { status: 503, headers: corsHeaders(origin) },
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
  const origin = request.headers.get("origin") ?? undefined;
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
    headers: corsHeaders(request.headers.get("origin") ?? undefined),
  });
}
