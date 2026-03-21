/**
 * Agent Checkout API
 *
 * Processes cart checkout with cUSD payments on Celo.
 * Supports commission splits: seller, platform, affiliate, agent.
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
import {
  calculateSplit,
  createCommissionRecord,
} from "../../../../lib/utils/commissions";
import { persistCommission } from "../../../../lib/middleware/agent-store";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import { corsHeaders } from "../../ai/_utils/http";
import {
  PLATFORM_WALLET,
  AGENT_WALLET,
  getExplorerUrl,
} from "../../../../config/chains";

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
      seller: PLATFORM_WALLET as Address, // All products sold by OnPoint for now
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
  affiliateId: z.string().optional(),
  referringAgentId: z.string().optional(),
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
    commissions: Array<{
      label: string;
      percentBps: number;
      amount: string;
      address: string;
    }>;
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

    const { items, chain, agentId, affiliateId, referringAgentId } =
      parsed.data;

    await AgentControls.initStore(agentId);

    // Validate all items and compute totals
    const resolvedItems: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      seller: Address;
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
        seller: product.seller,
      });
    }

    const totalWei = parseEther(totalAmount.toString());
    const totalFormatted = `${totalAmount} cUSD`;

    // Resolve affiliate/agent addresses
    // In production, look these up from a registry. For now, use known wallets.
    let affiliateAddress: Address | undefined;
    let agentAddress: Address | undefined;

    if (affiliateId) {
      // Affiliate wallet lookup — in production this queries a registry
      // For now, treat affiliateId as a wallet address if it looks like one
      if (affiliateId.startsWith("0x") && affiliateId.length === 42) {
        affiliateAddress = affiliateId as Address;
      }
    }

    if (referringAgentId) {
      // Agent wallet — use the agent wallet constant
      agentAddress = AGENT_WALLET;
    }

    // Calculate commission split
    const split = calculateSplit(totalWei, PLATFORM_WALLET, {
      affiliateAddress,
      agentAddress,
    });

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

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Get agent private key
    const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as
      | `0x${string}`
      | undefined;

    if (!agentPrivateKey) {
      // Demo mode: simulate success with commission split
      console.log(
        "[Checkout API] No AGENT_PRIVATE_KEY, simulating transfer with splits",
      );
      console.log(
        "[Checkout API] Split:",
        split.recipients.map(
          (r) =>
            `${r.label}: ${(Number(r.amount) / 1e18).toFixed(2)} cUSD (${r.percentBps / 100}%)`,
        ),
      );

      // Track commission record
      const commissionRecord = createCommissionRecord(orderId, split, {
        affiliateId,
        agentId: referringAgentId,
      });
      await persistCommission(commissionRecord);

      return NextResponse.json(
        {
          success: true,
          order: {
            id: orderId,
            items: resolvedItems.map(({ seller, ...item }) => item),
            totalAmount: totalFormatted,
            totalWei: totalWei.toString(),
            txHash: "0x" + "0".repeat(64),
            chain,
            explorerUrl: "https://celoscan.io",
            commissions: split.recipients.map((r) => ({
              label: r.label,
              percentBps: r.percentBps,
              amount: (Number(r.amount) / 1e18).toFixed(2),
              address: r.address,
            })),
            timestamp: Date.now(),
          },
        },
        { status: 200, headers: corsHeaders(origin) },
      );
    }

    // Execute cUSD transfers to each recipient
    const txHashes: string[] = [];

    for (const recipient of split.recipients) {
      if (recipient.amount === 0n) continue;

      const result: TokenTransferResult = await ERC20.transfer({
        chain,
        tokenAddress: cUSDAddress,
        to: recipient.address,
        amount: recipient.amount,
        privateKey: agentPrivateKey,
      });

      txHashes.push(result.hash);
    }

    // Record spending
    AgentControls.recordSpending(agentId, "purchase" as ActionType, totalWei);

    // Track commission record
    const commissionRecord = createCommissionRecord(orderId, split, {
      affiliateId,
      agentId: referringAgentId,
    });
    await persistCommission(commissionRecord);

    return NextResponse.json(
      {
        success: true,
        order: {
          id: orderId,
          items: resolvedItems.map(({ seller, ...item }) => item),
          totalAmount: totalFormatted,
          totalWei: totalWei.toString(),
          txHash: txHashes[0] ?? "0x",
          chain,
          explorerUrl: getExplorerUrl(chain, txHashes[0] ?? "0x"),
          commissions: split.recipients.map((r) => ({
            label: r.label,
            percentBps: r.percentBps,
            amount: (Number(r.amount) / 1e18).toFixed(2),
            address: r.address,
          })),
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
