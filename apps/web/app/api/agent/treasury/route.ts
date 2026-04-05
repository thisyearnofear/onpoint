/**
 * Treasury Management API - Phase 6.5
 * 
 * Manages agent treasury, revenue streams, and compute expenses.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseEther } from "viem";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import {
  getAgentTreasury,
  getTreasuryStats,
  addRevenue,
  recordExpense,
  payForCompute,
  autoFundTreasury,
} from "../../../../lib/services/treasury-service";
import { corsHeaders } from "../../ai/_utils/http";

const AddRevenueSchema = z.object({
  agentId: z.string().default("onpoint-stylist"),
  source: z.enum(["tips", "commissions", "subscriptions", "api_fees"]),
  amount: z.string().min(1),
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
});

const RecordExpenseSchema = z.object({
  agentId: z.string().default("onpoint-stylist"),
  type: z.enum(["compute", "api_call", "gas", "storage", "other"]),
  amount: z.string().min(1),
  description: z.string().min(1),
});

const PayComputeSchema = z.object({
  agentId: z.string().default("onpoint-stylist"),
  computeType: z.enum([
    "gemini_live",
    "venice_vision",
    "openai_gpt4",
    "ipfs_pin",
    "external_search",
  ]),
  description: z.string().min(1),
});

// GET - Check treasury balance and stats
export async function GET(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId") || "onpoint-stylist";
    const action = url.searchParams.get("action");

    try {
      if (action === "stats") {
        const stats = await getTreasuryStats(agentId);

        return NextResponse.json(
          {
            ...stats,
            treasury: stats.treasury
              ? {
                  ...stats.treasury,
                  balanceFormatted: `${parseFloat((BigInt(stats.treasury.balance) / BigInt(1e18)).toString())} cUSD`,
                  earnedFormatted: `${parseFloat((BigInt(stats.treasury.earned) / BigInt(1e18)).toString())} cUSD`,
                  spentFormatted: `${parseFloat((BigInt(stats.treasury.spent) / BigInt(1e18)).toString())} cUSD`,
                }
              : null,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      // Default: get treasury balance
      const treasury = await getAgentTreasury(agentId);

      if (!treasury) {
        return NextResponse.json(
          {
            exists: false,
            message: "No treasury found. Revenue will initialize it automatically.",
          },
          { status: 404, headers: corsHeaders(origin) },
        );
      }

      return NextResponse.json(
        {
          exists: true,
          treasury: {
            ...treasury,
            balanceFormatted: `${parseFloat((BigInt(treasury.balance) / BigInt(1e18)).toString())} cUSD`,
            earnedFormatted: `${parseFloat((BigInt(treasury.earned) / BigInt(1e18)).toString())} cUSD`,
            spentFormatted: `${parseFloat((BigInt(treasury.spent) / BigInt(1e18)).toString())} cUSD`,
          },
        },
        { status: 200, headers: corsHeaders(origin) },
      );
    } catch (error) {
      console.error("Treasury check error:", error);
      return NextResponse.json(
        { error: "Failed to check treasury" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

// POST - Manage treasury (add revenue, record expense, pay compute)
export async function POST(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const action = body.action as "add_revenue" | "record_expense" | "pay_compute" | "auto_fund";

      if (action === "add_revenue") {
        const parsed = AddRevenueSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const { agentId, source, amount, from, txHash } = parsed.data;
        const amountWei = parseEther(amount);

        const result = await addRevenue(
          agentId,
          source,
          amountWei,
          from as `0x${string}`,
          txHash,
        );

        return NextResponse.json(
          {
            success: true,
            message: `Added ${amount} cUSD to treasury`,
            treasury: result.treasury,
            revenue: result.revenue,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "record_expense") {
        const parsed = RecordExpenseSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const { agentId, type, amount, description } = parsed.data;
        const amountWei = parseEther(amount);

        const result = await recordExpense(agentId, type, amountWei, description);

        return NextResponse.json(
          {
            success: true,
            message: `Recorded expense of ${amount} cUSD`,
            treasury: result.treasury,
            expense: result.expense,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "pay_compute") {
        const parsed = PayComputeSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const { agentId, computeType, description } = parsed.data;

        const result = await payForCompute(agentId, computeType, description);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 402, headers: corsHeaders(origin) },
          );
        }

        return NextResponse.json(
          {
            success: true,
            message: `Paid for ${computeType}`,
            treasury: result.treasury,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "auto_fund") {
        const agentId = body.agentId || "onpoint-stylist";

        const result = await autoFundTreasury(agentId);

        return NextResponse.json(
          {
            funded: result.funded,
            message: result.funded
              ? "Treasury auto-funded"
              : "Treasury balance sufficient",
            treasury: result.treasury,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      return NextResponse.json(
        {
          error:
            "Invalid action. Use: add_revenue, record_expense, pay_compute, or auto_fund",
        },
        { status: 400, headers: corsHeaders(origin) },
      );
    } catch (error) {
      console.error("Treasury operation error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Operation failed" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get("origin") ?? undefined),
  });
}
