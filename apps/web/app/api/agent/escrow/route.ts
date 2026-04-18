/**
 * Escrow Management API - Phase 6.2
 * 
 * Manages user escrow accounts for agent spending.
 * Users deposit funds that agents can spend within approved allowances.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseEther } from "viem";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import {
  getEscrowBalance,
  initializeEscrow,
  depositToEscrow,
  updateAllowance,
  withdrawFromEscrow,
} from "../../../../lib/services/escrow-service";
import { logger } from "../../../../lib/utils/logger";
import { corsHeaders } from "../../ai/_utils/http";

const DepositSchema = z.object({
  amount: z.string().min(1),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  chainId: z.number().default(42220), // Celo mainnet
  agentId: z.string().default("onpoint-stylist"),
});
export { OPTIONS } from "../../ai/_utils/http";

const UpdateAllowanceSchema = z.object({
  allowance: z.string().min(1),
  agentId: z.string().default("onpoint-stylist"),
});

const WithdrawSchema = z.object({
  amount: z.string().min(1),
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  agentId: z.string().default("onpoint-stylist"),
});

// GET - Check escrow balance
export async function GET(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId") || "onpoint-stylist";

    try {
      const balance = await getEscrowBalance(ctx.userId, agentId);

      if (!balance) {
        return NextResponse.json(
          {
            exists: false,
            message: "No escrow account found. Initialize by depositing funds.",
          },
          { status: 404, headers: corsHeaders(origin) },
        );
      }

      return NextResponse.json(
        {
          exists: true,
          balance: {
            ...balance,
            balanceFormatted: `${parseFloat((BigInt(balance.balance) / BigInt(1e18)).toString())} cUSD`,
            allowanceFormatted: `${parseFloat((BigInt(balance.allowance) / BigInt(1e18)).toString())} cUSD`,
            spentFormatted: `${parseFloat((BigInt(balance.spent) / BigInt(1e18)).toString())} cUSD`,
            remainingFormatted: `${parseFloat(((BigInt(balance.allowance) - BigInt(balance.spent)) / BigInt(1e18)).toString())} cUSD`,
          },
        },
        { status: 200, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Escrow balance check error", { component: "escrow" }, error);
      return NextResponse.json(
        { error: "Failed to check escrow balance" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

// POST - Deposit or update allowance
export async function POST(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const action = body.action as "deposit" | "updateAllowance" | "withdraw";

      if (action === "deposit") {
        const parsed = DepositSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const { amount, txHash, chainId, agentId } = parsed.data;
        const amountWei = parseEther(amount);

        const balance = await depositToEscrow(
          ctx.userId,
          agentId,
          amountWei,
          txHash,
          chainId,
        );

        return NextResponse.json(
          {
            success: true,
            message: `Deposited ${amount} cUSD to escrow`,
            balance,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "updateAllowance") {
        const parsed = UpdateAllowanceSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const { allowance, agentId } = parsed.data;
        const allowanceWei = parseEther(allowance);

        const balance = await updateAllowance(ctx.userId, agentId, allowanceWei);

        return NextResponse.json(
          {
            success: true,
            message: `Updated allowance to ${allowance} cUSD`,
            balance,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "withdraw") {
        const parsed = WithdrawSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const { amount, recipient, agentId } = parsed.data;
        const amountWei = parseEther(amount);

        const result = await withdrawFromEscrow(
          ctx.userId,
          agentId,
          amountWei,
          recipient as `0x${string}`,
        );

        return NextResponse.json(
          {
            success: true,
            message: `Withdrawal initiated for ${amount} cUSD`,
            withdrawal: result.withdrawal,
            balance: result.balance,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      return NextResponse.json(
        { error: "Invalid action. Use: deposit, updateAllowance, or withdraw" },
        { status: 400, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Escrow operation error", { component: "escrow" }, error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Operation failed" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

