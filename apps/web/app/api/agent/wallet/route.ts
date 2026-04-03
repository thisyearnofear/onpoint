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
import {
  getAgentWalletInfo,
  getOWSWalletInfo,
} from "../../../../lib/services/agent-wallet";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";

export async function GET(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const [walletInfo, owsInfo] = await Promise.all([
        getAgentWalletInfo(),
        getOWSWalletInfo(),
      ]);

      return NextResponse.json(
        {
          agent: {
            name: "OnPoint AI Stylist",
            description:
              "Autonomous fashion styling agent with self-custodial wallet",
            capabilities: [
              "multi_chain_wallet",
              "receive_tips",
              "execute_payments",
              "nft_minting",
              "ows_policy_signing",
              "x402_payments",
            ],
          },
          wallets: walletInfo.walletInfo,
          addresses: walletInfo.addresses,
          supportedChains: ["Celo", "Base", "Ethereum", "Polygon"],
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
      console.error("Agent wallet error:", error);
      return NextResponse.json(
        { error: "Failed to get agent wallet info" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
