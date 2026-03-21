/**
 * Agent Tipping API
 *
 * Allows users to tip the AI Stylist agent using WDK.
 * Supports multiple chains and tokens.
 *
 * For Tether Hackathon Galactica - Tipping Bot Track
 */

import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";

interface TipRequest {
  fromAddress: string;
  toAddress: string;
  amount: string;
  chain: string;
  token?: string; // USDT, cUSD, etc.
  message?: string;
}

// Mock tipping - in production, this would use WDK to receive tips
// and track them in a database
const tipLedger: Array<{
  id: string;
  from: string;
  to: string;
  amount: string;
  chain: string;
  timestamp: number;
  txHash?: string;
}> = [];

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";

  try {
    const body: TipRequest = await request.json();
    const { fromAddress, toAddress, amount, chain, message } = body;

    // Validate request
    if (!fromAddress || !toAddress || !amount || !chain) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: fromAddress, toAddress, amount, chain",
        },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    // Validate addresses
    if (!fromAddress.startsWith("0x") || !toAddress.startsWith("0x")) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    // In production, this would:
    // 1. Use WDK to verify the user has sufficient balance
    // 2. Create and sign the transaction
    // 3. Broadcast to the network
    // 4. Wait for confirmation
    // For the hackathon demo, we simulate the tip

    const tipId = `tip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tip = {
      id: tipId,
      from: fromAddress,
      to: toAddress,
      amount,
      chain,
      timestamp: Date.now(),
    };

    tipLedger.push(tip);

    console.log(`[AgentTip] Received tip: ${amount} on ${chain}`, {
      from: fromAddress.slice(0, 6) + "..." + fromAddress.slice(-4),
      to: toAddress.slice(0, 6) + "..." + toAddress.slice(-4),
      message,
    });

    return NextResponse.json(
      {
        success: true,
        tip: {
          id: tipId,
          amount,
          chain,
          status: "received",
          timestamp: tip.timestamp,
        },
        agentResponse: message
          ? `Thank you for the ${amount} tip! Your message: "${message}" I'll keep styling! 💅`
          : `Thank you for the ${amount} tip! Your support helps me keep styling! 💅`,
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Tip processing error:", error);
    return NextResponse.json(
      { error: "Failed to process tip" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";

  // Return tip statistics
  const totalTips = tipLedger.reduce(
    (sum, tip) => sum + parseFloat(tip.amount),
    0,
  );
  const tipCount = tipLedger.length;

  return NextResponse.json(
    {
      totalTips: totalTips.toString(),
      tipCount,
      recentTips: tipLedger.slice(-10).reverse(),
    },
    { headers: corsHeaders(origin) },
  );
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
