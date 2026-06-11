/**
 * Agent Wallet API
 *
 * Exposes the AI Agent's self-custodial wallet capabilities.
 * For Tether Hackathon Galactica - Agent Wallets Track.
 *
 * Endpoints:
 * - GET /api/agent/wallet - Get wallet info (addresses, balances)
 * - POST /api/agent/wallet/tip - Receive a tip from user
 * - POST /api/agent/wallet/transaction - Execute a transaction
 */

import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { formatEther, parseEther } from "viem";
import {
  AgentControls,
  type ActionType,
} from "../../../../lib/middleware/agent-controls";
import {
  getAgentWalletInfo,
  getOWSWalletInfo,
} from "../../../../lib/services/agent-wallet";
import { logger } from "../../../../lib/utils/logger";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
export { OPTIONS } from "../../ai/_utils/http";

const POLICY_ACTIONS: ActionType[] = [
  "external_search",
  "external_purchase",
  "purchase",
  "tip",
  "mint",
];

function formatPolicyAmount(amount: bigint): number {
  return Number(formatEther(amount));
}

export async function GET(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const [walletInfo, owsInfo] = await Promise.all([
        getAgentWalletInfo(),
        getOWSWalletInfo(),
      ]);
      await AgentControls.initStore(ctx.agentId, ctx.userId);

      const limits = AgentControls.getAgentLimits(ctx.agentId, ctx.userId);
      const policyLimits = POLICY_ACTIONS.map((action) => {
        const limit = limits.find((item) => item.actionType === action);
        return {
          action,
          daily: limit ? formatPolicyAmount(limit.dailyLimit) : 0,
          perAction: limit ? formatPolicyAmount(limit.perActionLimit) : 0,
          remaining: limit
            ? formatPolicyAmount(
                limit.dailyLimit > limit.spentToday
                  ? limit.dailyLimit - limit.spentToday
                  : 0n,
              )
            : 0,
          requiresApproval: limit?.requiresApproval ?? true,
        };
      });
      const preferences = AgentControls.getStylePreferences(ctx.userId);
      const autonomyThreshold = AgentControls.getAutonomyThreshold(
        ctx.agentId,
        ctx.userId,
      );
      const capabilities = [
        "multi_chain_wallet",
        "receive_tips",
        "execute_payments",
        "nft_minting",
        "spending_controls",
        "verifiable_receipts",
      ];
      if (owsInfo) capabilities.push("policy_gated_signing", "x402_compatible");

      return NextResponse.json(
        {
          agent: {
            name: "OnPoint AI Stylist",
            description:
              "Autonomous fashion styling agent with self-custodial wallet",
            capabilities,
          },
          wallets: walletInfo.walletInfo,
          addresses: walletInfo.addresses,
          supportedChains: ["Celo", "Base", "Ethereum", "Polygon"],
          policy: {
            autonomyThreshold: formatPolicyAmount(autonomyThreshold),
            allowedActions: POLICY_ACTIONS,
            limits: policyLimits,
            autoBuy: {
              enabled: (preferences.autoBuyMaxPrice || 0) > 0,
              maxPrice: preferences.autoBuyMaxPrice || 0,
            },
            enforcement: {
              appLayer: true,
              signingLayer: !!owsInfo,
            },
          },
          ows: owsInfo
            ? {
                available: true,
                wallet: owsInfo.name,
                accounts: owsInfo.accounts,
              }
            : { available: false },
        },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Agent wallet error", { component: "wallet" }, error);
      return NextResponse.json(
        { error: "Failed to get agent wallet info" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

export async function PATCH(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const body = await req.json();
      const autonomyThreshold = body?.autonomyThreshold;
      const autoBuyMaxPrice = body?.autoBuyMaxPrice;

      await AgentControls.initStore(ctx.agentId, ctx.userId);

      if (autonomyThreshold !== undefined) {
        if (
          typeof autonomyThreshold !== "number" ||
          autonomyThreshold < 0 ||
          autonomyThreshold > 10000
        ) {
          return NextResponse.json(
            { error: "autonomyThreshold must be a number between 0 and 10000" },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        AgentControls.setAutonomyThreshold(
          ctx.agentId,
          ctx.userId,
          parseEther(String(autonomyThreshold)),
        );
      }

      if (autoBuyMaxPrice !== undefined) {
        if (
          typeof autoBuyMaxPrice !== "number" ||
          autoBuyMaxPrice < 0 ||
          autoBuyMaxPrice > 10000
        ) {
          return NextResponse.json(
            { error: "autoBuyMaxPrice must be a number between 0 and 10000" },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        AgentControls.updateStylePreferences(ctx.userId, { autoBuyMaxPrice });
      }

      return NextResponse.json(
        {
          success: true,
          autonomyThreshold: formatPolicyAmount(
            AgentControls.getAutonomyThreshold(ctx.agentId, ctx.userId),
          ),
          autoBuyMaxPrice:
            AgentControls.getStylePreferences(ctx.userId).autoBuyMaxPrice || 0,
        },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Agent policy update error", { component: "wallet" }, error);
      return NextResponse.json(
        { error: "Failed to update agent policy" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}
