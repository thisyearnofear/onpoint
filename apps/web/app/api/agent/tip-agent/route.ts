/**
 * Agent-to-Agent Tipping API
 *
 * Allows one AI agent to tip another agent via Tether WDK.
 * Demonstrates autonomous agent-to-agent economic interactions.
 *
 * Flow:
 * 1. Tipping agent resolves its own WDK wallet
 * 2. Recipient agent's WDK wallet address is resolved
 * 3. Transfer is recorded (server tracks; client executes via wagmi/viem)
 * 4. Both agents' ledger entries are updated
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { getAgentWallet } from "../../../../lib/services/agent-wallet";
import {
  AgentControls,
  type ActionType,
} from "../../../../lib/middleware/agent-controls";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";

interface AgentTipRequest {
  fromAgentId: string;
  toAgentId: string;
  amount: string;
  chain: string;
  token?: string;
  message?: string;
}

// In-memory agent-to-agent tip ledger
const agentTipLedger: Array<{
  id: string;
  fromAgentId: string;
  toAgentId: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  chain: string;
  token: string;
  timestamp: number;
  message?: string;
  status: "pending" | "confirmed" | "failed";
}> = [];

/**
 * Resolve agent WDK address for a given chain.
 * NOTE: In the current architecture, all agents share the same WDK wallet.
 * For true agent-to-agent tipping with distinct wallets, each agent would need
 * its own WDK seed phrase. Currently used for internal tip recording only.
 */
async function resolveAgentAddress(chain: string): Promise<string> {
  try {
    const wallet = await getAgentWallet();
    const addresses = await wallet.getAddresses();
    return (
      addresses[chain] ??
      addresses.celo ??
      addresses.base ??
      Object.values(addresses)[0] ??
      ""
    );
  } catch (err) {
    console.error("[AgentToAgent] Failed to resolve WDK address:", err);
    return "";
  }
}

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const body: AgentTipRequest = await req.json();
      const { fromAgentId, toAgentId, amount, chain, token, message } = body;

      // Validate request
      if (!fromAgentId || !toAgentId || !amount || !chain) {
        return NextResponse.json(
          {
            error:
              "Missing required fields: fromAgentId, toAgentId, amount, chain",
          },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      if (fromAgentId === toAgentId) {
        return NextResponse.json(
          { error: "Agent cannot tip itself" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      // Validate amount is positive
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json(
          { error: "Amount must be a positive number" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      // Initialize spending controls for the tipping agent
      await AgentControls.initStore(fromAgentId, ctx.userId);

      // Resolve recipient agent's wallet address for validation
      const recipientAddress = await resolveAgentAddress(chain);

      // Convert amount to wei for spending limit validation
      const { parseEther } = await import("viem");
      const amountWei = parseEther(amount);

      // Validate against spending limits (agent-to-agent uses "tip" action type)
      const validation = AgentControls.validateAction({
        agentId: fromAgentId,
        userId: ctx.userId,
        actionType: "tip" as ActionType,
        amount: amountWei,
        amountFormatted: `${amount} ${token || "cUSD"}`,
        description: `Agent tip: ${fromAgentId} → ${toAgentId}`,
        recipient: recipientAddress || undefined,
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
            error: validation.reason || "Agent tip not allowed",
          },
          { status: 403, headers: corsHeaders(origin) },
        );
      }

      // Resolve agent WDK wallet addresses
      // NOTE: Currently resolves to the same wallet since all agents share one WDK wallet.
      // For multi-agent tipping, each agent needs its own WDK identity.
      const fromAddress = await resolveAgentAddress(chain);
      const toAddress = await resolveAgentAddress(chain);

      if (!fromAddress) {
        return NextResponse.json(
          { error: "Tipping agent wallet not available" },
          { status: 503, headers: corsHeaders(origin) },
        );
      }

      if (!toAddress) {
        return NextResponse.json(
          { error: "Recipient agent wallet not available" },
          { status: 503, headers: corsHeaders(origin) },
        );
      }

      const tipId = `a2a_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tipToken = token || (chain === "celo" ? "cUSD" : "USDT");

      // Record the agent-to-agent tip
      const tipRecord = {
        id: tipId,
        fromAgentId,
        toAgentId,
        fromAddress,
        toAddress,
        amount,
        chain,
        token: tipToken,
        timestamp: Date.now(),
        message,
        status: "pending" as const,
      };

      agentTipLedger.push(tipRecord);

      // Record spending for the tipping agent
      AgentControls.recordSpending(
        fromAgentId,
        ctx.userId,
        "tip" as ActionType,
        amountWei,
      );

      console.log(
        `[AgentToAgent] ${fromAgentId} → ${toAgentId}: ${amount} ${tipToken} on ${chain}`,
        {
          from: fromAddress.slice(0, 6) + "..." + fromAddress.slice(-4),
          to: toAddress.slice(0, 6) + "..." + toAddress.slice(-4),
        },
      );

      return NextResponse.json(
        {
          success: true,
          tip: {
            id: tipId,
            fromAgentId,
            toAgentId,
            amount,
            token: tipToken,
            chain,
            fromAddress,
            toAddress,
            status: "pending",
            timestamp: tipRecord.timestamp,
          },
          agentResponse: message
            ? `${toAgentId} received your ${amount} ${tipToken} tip: "${message}"`
            : `${toAgentId} received your ${amount} ${tipToken} tip!`,
        },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      console.error("Agent-to-agent tip error:", error);
      return NextResponse.json(
        { error: "Failed to process agent tip" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

export async function GET(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const wallet = await getAgentWallet();
      const addresses = await wallet.getAddresses();

      // Compute stats
      const totalVolume = agentTipLedger.reduce(
        (sum, tip) => sum + parseFloat(tip.amount),
        0,
      );

      return NextResponse.json(
        {
          agentAddresses: addresses,
          totalAgentTips: agentTipLedger.length,
          totalVolume: totalVolume.toString(),
          recentAgentTips: agentTipLedger.slice(-10).reverse(),
        },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      console.error("Agent-to-agent GET error:", error);
      return NextResponse.json(
        { error: "Failed to get agent tip info" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
