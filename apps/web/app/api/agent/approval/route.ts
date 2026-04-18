/**
 * Agent Approval API
 *
 * Manages approval requests for agent actions.
 * Supports creating, checking, approving, and rejecting requests.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 *
 * Authentication: Required for all operations (spending control)
 * Rate Limiting: 60 req/min (free), 500 req/min (premium)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AgentControls,
  type ActionType,
} from "../../../../lib/middleware/agent-controls";
import { logger } from "../../../../lib/utils/logger";
import { corsHeaders } from "../../ai/_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
export { OPTIONS } from "../../ai/_utils/http";

// Request schemas
const CreateApprovalSchema = z.object({
  actionType: z.enum(["tip", "purchase", "mint", "premium", "agent_to_agent"]),
  amount: z.string().min(1),
  description: z.string().min(1),
  recipient: z.string().optional(),
  agentId: z.string().default("onpoint-stylist"),
});

const UpdateApprovalSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

// GET - Check approval status (requires auth)
export async function GET(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    // Use authenticated user's agentId
    const agentId = url.searchParams.get("agentId") || ctx.agentId;

    await AgentControls.initStore(agentId, ctx.userId);

    try {
      if (id) {
        // Get specific approval request
        const approvalRequest = AgentControls.getApprovalRequest(id);

        if (!approvalRequest) {
          return NextResponse.json(
            { error: "Approval request not found" },
            { status: 404, headers: corsHeaders(origin) },
          );
        }

        // Verify ownership
        if (approvalRequest.agentId !== agentId) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403, headers: corsHeaders(origin) },
          );
        }

        return NextResponse.json(
          { request: approvalRequest },
          { status: 200, headers: corsHeaders(origin) },
        );
      } else {
        // Get all pending approvals for agent
        const pendingApprovals = AgentControls.getPendingApprovals(agentId);

        return NextResponse.json(
          { requests: pendingApprovals },
          { status: 200, headers: corsHeaders(origin) },
        );
      }
    } catch (error) {
      logger.error("Approval GET error", { component: "approval" }, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

// POST - Create approval request (requires auth)
export async function POST(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const parsed = CreateApprovalSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.message },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const { actionType, amount, description, recipient, agentId } = parsed.data;

      // Use authenticated agentId
      const effectiveAgentId = agentId || ctx.agentId;

      await AgentControls.initStore(effectiveAgentId, ctx.userId);

      // Create the approval request using AgentControls
      const approvalRequest = AgentControls.createApprovalRequest({
        agentId: effectiveAgentId,
        userId: ctx.userId,
        actionType: actionType as ActionType,
        amount,
        description,
        recipient,
        expiresInMinutes: 5, // 5 minute expiry
      });

      return NextResponse.json(
        { request: approvalRequest },
        { status: 201, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Approval POST error", { component: "approval" }, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

// PATCH - Approve or reject request (requires auth)
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const parsed = UpdateApprovalSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.message },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const { id, action } = parsed.data;

      await AgentControls.initStore(ctx.agentId, ctx.userId);

      let success: boolean;

      if (action === "approve") {
        success = AgentControls.approveRequest(id, ctx.userId);
      } else {
        success = AgentControls.rejectRequest(id, ctx.userId);
      }

      if (!success) {
        return NextResponse.json(
          { error: "Failed to update approval request" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const updatedRequest = AgentControls.getApprovalRequest(id);

      return NextResponse.json(
        { request: updatedRequest },
        { status: 200, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Approval PATCH error", { component: "approval" }, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

