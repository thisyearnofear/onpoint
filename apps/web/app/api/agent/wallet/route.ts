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
import { getAgentWalletInfo } from "../../../../lib/services/agent-wallet";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";

  try {
    const walletInfo = await getAgentWalletInfo();

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
          ],
        },
        wallets: walletInfo.walletInfo,
        addresses: walletInfo.addresses,
        supportedChains: ["Celo", "Base", "Ethereum", "Polygon"],
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
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
