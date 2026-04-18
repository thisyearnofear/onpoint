/**
 * Fraud Detection API - Phase 6.4
 * 
 * Monitors agent health, manages freezing, and handles multi-sig approvals.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import {
  checkAgentHealth,
  isAgentFrozen,
  freezeAgent,
  unfreezeAgent,
  getMultiSigRequirement,
  addMultiSigSignature,
} from "../../../../lib/services/fraud-detection";
import { logger } from "../../../../lib/utils/logger";
import { corsHeaders } from "../../ai/_utils/http";

const FreezeSchema = z.object({
  agentId: z.string(),
  reason: z.string().min(1),
});
export { OPTIONS } from "../../ai/_utils/http";

const UnfreezeSchema = z.object({
  agentId: z.string(),
});

const MultiSigSignSchema = z.object({
  transactionId: z.string(),
  signature: z.string(),
});

// GET - Check agent health and fraud status
export async function GET(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId") || "onpoint-stylist";
    const action = url.searchParams.get("action");

    try {
      if (action === "health") {
        const health = await checkAgentHealth(agentId, ctx.userId);
        const frozenStatus = await isAgentFrozen(agentId, ctx.userId);

        return NextResponse.json(
          {
            health,
            frozen: frozenStatus,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "multisig") {
        const txId = url.searchParams.get("txId");
        if (!txId) {
          return NextResponse.json(
            { error: "Transaction ID required" },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const requirement = await getMultiSigRequirement(txId);
        if (!requirement) {
          return NextResponse.json(
            { error: "Multi-sig requirement not found" },
            { status: 404, headers: corsHeaders(origin) },
          );
        }

        return NextResponse.json(
          { requirement },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      return NextResponse.json(
        { error: "Invalid action. Use: health or multisig" },
        { status: 400, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Fraud check error", { component: "fraud" }, error);
      return NextResponse.json(
        { error: "Failed to check fraud status" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

// POST - Manage fraud controls (freeze, unfreeze, sign multisig)
export async function POST(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const action = body.action as "freeze" | "unfreeze" | "sign_multisig";

      if (action === "freeze") {
        const parsed = FreezeSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const { agentId, reason } = parsed.data;

        // In production, verify admin privileges
        await freezeAgent(agentId, ctx.userId, reason);

        return NextResponse.json(
          {
            success: true,
            message: `Agent ${agentId} frozen`,
            reason,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "unfreeze") {
        const parsed = UnfreezeSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const { agentId } = parsed.data;

        // In production, verify admin privileges
        await unfreezeAgent(agentId, ctx.userId);

        return NextResponse.json(
          {
            success: true,
            message: `Agent ${agentId} unfrozen`,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "sign_multisig") {
        const parsed = MultiSigSignSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const { transactionId, signature } = parsed.data;

        const requirement = await addMultiSigSignature(
          transactionId,
          ctx.userId,
          signature,
        );

        if (!requirement) {
          return NextResponse.json(
            { error: "Multi-sig requirement not found" },
            { status: 404, headers: corsHeaders(origin) },
          );
        }

        return NextResponse.json(
          {
            success: true,
            requirement,
            approved: requirement.status === "approved",
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      return NextResponse.json(
        { error: "Invalid action. Use: freeze, unfreeze, or sign_multisig" },
        { status: 400, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Fraud control error", { component: "fraud" }, error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Operation failed" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

