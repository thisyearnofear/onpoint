/**
 * Agent Approval API
 *
 * Manages approval requests for agent actions.
 * Supports creating, checking, approving, and rejecting requests.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AgentControls,
  type ActionType,
} from "../../../../lib/middleware/agent-controls";
import { corsHeaders } from "../../ai/_utils/http";

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

// GET - Check approval status
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const agentId = url.searchParams.get("agentId") || "onpoint-stylist";

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
    console.error("Approval GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// POST - Create approval request
export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    const body = await request.json();
    const parsed = CreateApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const { actionType, amount, description, recipient, agentId } = parsed.data;

    // Create the approval request using AgentControls
    const approvalRequest = AgentControls.createApprovalRequest({
      agentId,
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
    console.error("Approval POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// PATCH - Approve or reject request
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    const body = await request.json();
    const parsed = UpdateApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const { id, action } = parsed.data;

    let success: boolean;

    if (action === "approve") {
      success = AgentControls.approveRequest(id);
    } else {
      success = AgentControls.rejectRequest(id);
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
    console.error("Approval PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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
