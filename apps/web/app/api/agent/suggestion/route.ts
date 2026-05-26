/**
 * Agent Suggestion API
 *
 * Manages agent suggestions with quick-accept for small amounts.
 * Supports autonomous execution for amounts below threshold.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 *
 * Authentication: Required for all operations
 * Rate Limiting: 60 req/min (free), 500 req/min (premium)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AgentControls,
  loadSuggestionFromStore,
  persistSuggestion,
  type ActionType,
} from "../../../../lib/middleware/agent-controls";
import { logger } from "../../../../lib/utils/logger";
import { corsHeaders } from "../../ai/_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import { VerifiableAgentService } from "../../../../lib/services/verifiable-agent-service";
import { executeSuggestion } from "../../../../lib/services/autonomous-executor";
export { OPTIONS } from "../../ai/_utils/http";

// Request schemas
const CreateSuggestionSchema = z.object({
  actionType: z.enum([
    "tip",
    "purchase",
    "mint",
    "premium",
    "agent_to_agent",
    "external_search",
  ]),
  amount: z.string().min(1),
  description: z.string().min(1),
  recipient: z.string().optional(),
  agentId: z.string().default("onpoint-stylist"),
  isSearching: z.boolean().optional(),
  liveUrl: z.string().optional(),
});

const UpdateSuggestionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["accept", "reject"]),
});

// GET - List suggestions (requires auth)
export async function GET(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    // Use authenticated user's ID for agentId if not specified
    const agentId = url.searchParams.get("agentId") || ctx.agentId;

    await AgentControls.initStore(agentId, ctx.userId);

    try {
      if (id) {
        const suggestion = AgentControls.getSuggestion(id);

        if (!suggestion) {
          return NextResponse.json(
            { error: "Suggestion not found" },
            { status: 404, headers: corsHeaders(origin) },
          );
        }

        // Verify user owns this suggestion
        if (suggestion.agentId !== agentId) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403, headers: corsHeaders(origin) },
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
      logger.error("Suggestion GET error", { component: "suggestion" }, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

// POST - Create suggestion (requires auth)
export async function POST(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const parsed = CreateSuggestionSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.message },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const {
        actionType,
        amount,
        description,
        recipient,
        agentId,
        isSearching,
        liveUrl,
      } = parsed.data;

      // Use authenticated agentId if not provided
      const effectiveAgentId = agentId || ctx.agentId;

      await AgentControls.initStore(effectiveAgentId, ctx.userId);

      // Use suggestAction which handles autonomy threshold
      const result = AgentControls.suggestAction({
        agentId: effectiveAgentId,
        userId: ctx.userId,
        actionType: actionType as ActionType,
        amount,
        description,
        recipient,
        metadata: {
          isSearching,
          liveUrl,
        },
      });

      // HACKATHON: Create Verifiable Agent Log (IPFS/Filecoin)
      // Provides transparent, tamper-proof audit trails for agent decisions.
      try {
        const { cid, signature } =
          await VerifiableAgentService.createVerifiableLog(
            result.suggestion,
            ctx.userId,
          );

        // Update suggestion with verifiability info
        result.suggestion.verifiableLogCid = cid;
        result.suggestion.signature = signature;

        // Re-persist the updated suggestion
        await persistSuggestion(result.suggestion, ctx.userId);
        logger.info("Verifiable log attached", { component: "suggestion", cid });
      } catch (err) {
        logger.error("Failed to create verifiable log", { component: "suggestion" }, err);
        // Continue anyway - don't block the user if IPFS is down
      }

      // AUTONOMOUS EXECUTION: if auto-approved, execute immediately
      let executionResult: Awaited<ReturnType<typeof executeSuggestion>> | undefined;
      if (result.autoExecuted && result.suggestion.actionType !== "external_search") {
        logger.info("Auto-executing suggestion", {
          component: "suggestion",
          suggestionId: result.suggestion.id,
          actionType: result.suggestion.actionType,
        });

        executionResult = await executeSuggestion({
          agentId: result.suggestion.agentId,
          userId: ctx.userId,
          userAddress: ctx.userId || result.suggestion.recipient || "",
          actionType: result.suggestion.actionType,
          amount: result.suggestion.amount,
          description: result.suggestion.description,
          recipient: result.suggestion.recipient,
          metadata: result.suggestion.metadata,
          suggestionId: result.suggestion.id,
        });

        if (executionResult.success) {
          AgentControls.markSuggestionExecuted(result.suggestion.id, ctx.userId);
          logger.info("Auto-execution succeeded", {
            component: "suggestion",
            suggestionId: result.suggestion.id,
            txHash: executionResult.txHash,
          });
        } else {
          logger.error("Auto-execution failed", {
            component: "suggestion",
            suggestionId: result.suggestion.id,
            error: executionResult.error,
          });
        }
      }

      return NextResponse.json(
        {
          suggestion: result.suggestion,
          autoExecuted: result.autoExecuted,
          executed: executionResult
            ? {
                success: executionResult.success,
                txHash: executionResult.txHash,
                explorerUrl: executionResult.explorerUrl,
                error: executionResult.error,
              }
            : undefined,
          message: result.autoExecuted
            ? executionResult?.success
              ? "Action auto-approved and executed onchain"
              : "Action auto-approved but execution failed"
            : "Suggestion created - awaiting user approval",
        },
        { status: 201, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Suggestion POST error", { component: "suggestion" }, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

// PATCH - Accept or reject suggestion (requires auth)
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const parsed = UpdateSuggestionSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.message },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const { id, action } = parsed.data;

      // Ensure store is hydrated (load suggestion if not in memory)
      if (!AgentControls.getSuggestion(id)) {
        const stored = await loadSuggestionFromStore(id);
        if (stored) {
          await AgentControls.initStore(stored.agentId, ctx.userId);
        }
      }

      let success: boolean;
      let executionResult: Awaited<ReturnType<typeof executeSuggestion>> | undefined;

      if (action === "accept") {
        success = AgentControls.acceptSuggestion(id, ctx.userId);

        // AUTONOMOUS EXECUTION: if accepted, execute the action onchain
        if (success) {
          const suggestion = AgentControls.getSuggestion(id);
          if (suggestion && suggestion.actionType !== "external_search") {
            logger.info("Autonomous execution starting", {
              component: "suggestion",
              suggestionId: id,
              actionType: suggestion.actionType,
            });

            executionResult = await executeSuggestion({
              agentId: suggestion.agentId,
              userId: ctx.userId,
              userAddress: ctx.userId || suggestion.recipient || "",
              actionType: suggestion.actionType,
              amount: suggestion.amount,
              description: suggestion.description,
              recipient: suggestion.recipient,
              metadata: suggestion.metadata,
              suggestionId: id,
            });

            if (executionResult.success) {
              AgentControls.markSuggestionExecuted(id, ctx.userId);
              logger.info("Autonomous execution succeeded", {
                component: "suggestion",
                suggestionId: id,
                txHash: executionResult.txHash,
              });
            } else {
              logger.error("Autonomous execution failed", {
                component: "suggestion",
                suggestionId: id,
                error: executionResult.error,
              });
            }
          }
        }
      } else {
        success = AgentControls.rejectSuggestion(id, ctx.userId);
      }

      if (!success) {
        return NextResponse.json(
          { error: "Failed to update suggestion" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const updatedSuggestion = AgentControls.getSuggestion(id);

      return NextResponse.json(
        {
          suggestion: updatedSuggestion,
          executed: executionResult
            ? {
                success: executionResult.success,
                txHash: executionResult.txHash,
                explorerUrl: executionResult.explorerUrl,
                error: executionResult.error,
              }
            : undefined,
        },
        { status: 200, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Suggestion PATCH error", { component: "suggestion" }, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

