/**
 * Agent Suggestion API
 *
 * Manages agent suggestions with quick-accept for small amounts.
 * Supports autonomous execution for amounts below threshold.
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
const CreateSuggestionSchema = z.object({
  actionType: z.enum(["tip", "purchase", "mint", "premium", "agent_to_agent"]),
  amount: z.string().min(1),
  description: z.string().min(1),
  recipient: z.string().optional(),
  agentId: z.string().default("onpoint-stylist"),
});

const UpdateSuggestionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["accept", "reject"]),
});

// GET - List suggestions
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const agentId = url.searchParams.get("agentId") || "onpoint-stylist";

  try {
    if (id) {
      const suggestion = AgentControls.getSuggestion(id);

      if (!suggestion) {
        return NextResponse.json(
          { error: "Suggestion not found" },
          { status: 404, headers: corsHeaders(origin) },
        );
      }

      return NextResponse.json(
        { suggestion },
        { status: 200, headers: corsHeaders(origin) },
      );
    } else {
      const pendingSuggestions = AgentControls.getPendingSuggestions(agentId);

      return NextResponse.json(
        { suggestions: pendingSuggestions },
        { status: 200, headers: corsHeaders(origin) },
      );
    }
  } catch (error) {
    console.error("Suggestion GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// POST - Create suggestion
export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    const body = await request.json();
    const parsed = CreateSuggestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const { actionType, amount, description, recipient, agentId } = parsed.data;

    // Use suggestAction which handles autonomy threshold
    const result = AgentControls.suggestAction({
      agentId,
      actionType: actionType as ActionType,
      amount,
      description,
      recipient,
    });

    return NextResponse.json(
      {
        suggestion: result.suggestion,
        autoExecuted: result.autoExecuted,
        message: result.autoExecuted
          ? "Action auto-approved (below autonomy threshold)"
          : "Suggestion created - awaiting user approval",
      },
      { status: 201, headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Suggestion POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// PATCH - Accept or reject suggestion
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    const body = await request.json();
    const parsed = UpdateSuggestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const { id, action } = parsed.data;

    let success: boolean;

    if (action === "accept") {
      success = AgentControls.acceptSuggestion(id);
    } else {
      success = AgentControls.rejectSuggestion(id);
    }

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update suggestion" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const updatedSuggestion = AgentControls.getSuggestion(id);

    return NextResponse.json(
      { suggestion: updatedSuggestion },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Suggestion PATCH error:", error);
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
