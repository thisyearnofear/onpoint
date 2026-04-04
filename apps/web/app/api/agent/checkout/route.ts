/**
 * Agent Checkout API
 *
 * Processes cart checkout with cUSD/USDT payments via Tether WDK.
 * Supports commission splits: seller, platform, affiliate, agent.
 *
 * x402 support: if the request includes an X-PAYMENT header, the payment
 * is verified via the x402 facilitator before executing the on-chain transfer.
 * Without X-PAYMENT, returns HTTP 402 with payment requirements so any
 * x402-compatible agent wallet can pay automatically.
 *
 * OWS Hackathon Track: x402/MPP payment rails + OWS wallet compatibility.
 * Tether Hackathon Track: WDK self-custodial wallet + commission splits.
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
import { getAgentWallet } from "../../../../lib/services/agent-wallet";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import { logger } from "../../../../lib/utils/logger";
import {
  buildPaymentRequirements,
  getPaymentHeader,
} from "../../../../lib/utils/x402";
import { verify, settle } from "x402/verify";

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
  chain: z.enum(["celo", "celoSepolia"]).default("celo"),
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
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const parsed = CheckoutSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: parsed.error.message },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const { items, chain, agentId, affiliateId, referringAgentId } =
        parsed.data;

      await AgentControls.initStore(agentId, ctx.userId);

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

      // ── x402 Payment Check ──────────────────────────────────────────────
      // If the caller is an x402-compatible agent wallet, it will include
      // X-PAYMENT. Without it, return 402 with requirements so the agent
      // can pay automatically and retry.
      const paymentHeader = getPaymentHeader(req.headers);
      const resourceUrl = `${req.nextUrl.origin}/api/agent/checkout`;
      const requirements = buildPaymentRequirements(
        totalAmount,
        AGENT_WALLET,
        resourceUrl,
        `OnPoint checkout: ${resolvedItems.map((i) => i.name).join(", ")}`,
      );

      if (!paymentHeader) {
        // No payment header — return 402 so x402 clients can pay and retry
        return NextResponse.json(
          {
            success: false,
            x402Version: 1,
            accepts: [requirements],
          } as unknown as CheckoutResponse,
          {
            status: 402,
            headers: {
              ...corsHeaders(origin),
              "X-Payment-Required": "true",
            },
          },
        );
      }

      // Verify the x402 payment before executing
      try {
        const paymentPayload = JSON.parse(
          Buffer.from(paymentHeader, "base64").toString("utf8"),
        );
        const verifyResult = await verify(paymentPayload, requirements);
        if (!verifyResult.isValid) {
          return NextResponse.json(
            {
              success: false,
              error: `Payment invalid: ${verifyResult.invalidReason}`,
            },
            { status: 402, headers: corsHeaders(origin) },
          );
        }
      } catch (verifyErr) {
        logger.warn("x402 verify failed", { component: "checkout" }, verifyErr);
        return NextResponse.json(
          { success: false, error: "Payment verification failed" },
          { status: 402, headers: corsHeaders(origin) },
        );
      }
      // ────────────────────────────────────────────────────────────────────

      // Validate against spending limits
      const validation = AgentControls.validateAction({
        agentId,
        userId: ctx.userId,
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
          {
            success: false,
            error: validation.reason || "Checkout not allowed",
          },
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
            component: "checkout",
            chain,
            agentWdkAddress,
          });
        }
      } catch (wdkErr) {
        logger.warn("WDK not available", { component: "checkout" }, wdkErr);
      }

      // Get agent private key from environment
      const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as
        | `0x${string}`
        | undefined;

      if (!agentPrivateKey) {
        // Production: signing required for real on-chain receipts
        logger.error("AGENT_PRIVATE_KEY not configured", {
          component: "checkout",
        });

        return NextResponse.json(
          {
            success: false,
            error:
              "Agent signing not configured. Set AGENT_PRIVATE_KEY to enable real checkout with on-chain receipts.",
            code: "SIGNING_NOT_CONFIGURED",
          },
          { status: 503, headers: corsHeaders(origin) },
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
      AgentControls.recordSpending(
        agentId,
        ctx.userId,
        "purchase" as ActionType,
        totalWei,
      );

      // Settle x402 payment on-chain (fire-and-forget — tx already confirmed above)
      try {
        const paymentPayload = JSON.parse(
          Buffer.from(paymentHeader, "base64").toString("utf8"),
        );
        await settle(paymentPayload, requirements);
      } catch (settleErr) {
        logger.warn(
          "x402 settle failed (non-fatal)",
          { component: "checkout" },
          settleErr,
        );
      }

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
      logger.apiError("/api/agent/checkout", "Checkout error", error);
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

// OPTIONS - CORS preflight
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get("origin") ?? undefined),
  });
}
