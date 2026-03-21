/**
 * Agent Checkout API
 *
 * Processes cart checkout with cUSD payments on Celo.
 * Supports the agent-driven purchase flow with spending limits.
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

// Build product lookup from catalog
const PRODUCT_MAP = Object.fromEntries(
  CANVAS_ITEMS.map((item) => [
    item.id,
    {
      id: item.id,
      slug: item.slug,
      name: item.name,
      price: item.price,
      category: item.category,
    },
  ]),
);

const CheckoutItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1).max(10),
});

const CheckoutSchema = z.object({
  items: z.array(CheckoutItemSchema).min(1),
  chain: z.enum(["celo", "celoAlfajores"]).default("celo"),
  agentId: z.string().default("onpoint-stylist"),
});

interface CheckoutResponse {
  success: boolean;
  order?: {
    id: string;
    items: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    totalAmount: string;
    totalWei: string;
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
): Promise<NextResponse<CheckoutResponse>> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    const body = await request.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const { items, chain, agentId } = parsed.data;

    await AgentControls.initStore(agentId);

    // Validate all items and compute totals
    const resolvedItems: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }> = [];

    let totalAmount = 0;

    for (const item of items) {
      const product = PRODUCT_MAP[item.productId];
      if (!product) {
        return NextResponse.json(
          { success: false, error: `Product not found: ${item.productId}` },
          { status: 404, headers: corsHeaders(origin) },
        );
      }

      const subtotal = product.price * item.quantity;
      totalAmount += subtotal;

      resolvedItems.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal,
      });
    }

    const totalWei = parseEther(totalAmount.toString());
    const totalFormatted = `${totalAmount} cUSD`;

    // Validate against spending limits
    const validation = AgentControls.validateAction({
      agentId,
      actionType: "purchase" as ActionType,
      amount: totalWei,
      amountFormatted: totalFormatted,
      description: `Checkout: ${resolvedItems.map((i) => `${i.quantity}x ${i.name}`).join(", ")}`,
      recipient: PLATFORM_WALLET,
    });

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

    if (!validation.allowed) {
      return NextResponse.json(
        { success: false, error: validation.reason || "Checkout not allowed" },
        { status: 403, headers: corsHeaders(origin) },
      );
    }

    // Check cUSD availability on chain
    const cUSDAddress = ERC20.getCUSDAddress(chain);
    if (!cUSDAddress) {
      return NextResponse.json(
        { success: false, error: `cUSD not available on ${chain}` },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    // Get agent private key
    const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as
      | `0x${string}`
      | undefined;

    if (!agentPrivateKey) {
      // Demo mode: simulate success
      console.log("[Checkout API] No AGENT_PRIVATE_KEY, simulating transfer");

      const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      return NextResponse.json(
        {
          success: true,
          order: {
            id: orderId,
            items: resolvedItems,
            totalAmount: totalFormatted,
            totalWei: totalWei.toString(),
            txHash: "0x" + "0".repeat(64),
            chain,
            explorerUrl: "https://celoscan.io",
            timestamp: Date.now(),
          },
        },
        { status: 200, headers: corsHeaders(origin) },
      );
    }

    // Execute cUSD transfer
    const transferResult: TokenTransferResult = await ERC20.transfer({
      chain,
      tokenAddress: cUSDAddress,
      to: PLATFORM_WALLET,
      amount: totalWei,
      privateKey: agentPrivateKey,
    });

    // Record spending
    AgentControls.recordSpending(agentId, "purchase" as ActionType, totalWei);

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return NextResponse.json(
      {
        success: true,
        order: {
          id: orderId,
          items: resolvedItems,
          totalAmount: totalFormatted,
          totalWei: totalWei.toString(),
          txHash: transferResult.hash,
          chain,
          explorerUrl: getExplorerUrl(chain, transferResult.hash),
          timestamp: Date.now(),
        },
      },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get("origin") ?? undefined),
  });
}
