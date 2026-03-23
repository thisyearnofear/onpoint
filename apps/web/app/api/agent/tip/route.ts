/**
 * Agent Tipping API
 *
 * Allows users to tip the AI Stylist agent via Tether WDK.
 * Supports multiple chains and tokens (cUSD, USDT).
 *
 * The agent's self-custodial wallet address is resolved from WDK.
 * Users send tips from their connected wallet (wagmi/RainbowKit on client).
 * This route validates the agent wallet, tracks the tip, and returns
 * the agent's confirmed address for the specified chain.
 *
 * For Tether Hackathon Galactica - Tipping Bot Track
 */

import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { getAgentWallet } from "../../../../lib/services/agent-wallet";

interface TipRequest {
  fromAddress: string;
  amount: string;
  chain: string;
  token?: string; // USDT, cUSD, etc.
  message?: string;
}

// In-memory tip ledger (production would use Redis/DB)
const tipLedger: Array<{
  id: string;
  from: string;
  to: string;
  amount: string;
  chain: string;
  token: string;
  timestamp: number;
  message?: string;
  txHash?: string;
  status: "pending" | "confirmed" | "failed";
}> = [];

/**
 * Resolve the agent's WDK wallet address for a given chain.
 * Falls back to Celo address if the requested chain isn't registered.
 */
async function resolveAgentAddress(chain: string): Promise<string> {
  try {
    const wallet = await getAgentWallet();
    const addresses = await wallet.getAddresses();
    // Try the requested chain first, then fallback to any available
    return (
      addresses[chain] ??
      addresses.celo ??
      addresses.base ??
      Object.values(addresses)[0] ??
      ""
    );
  } catch (err) {
    console.error("[AgentTip] Failed to resolve WDK agent address:", err);
    return "";
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";

  try {
    const body: TipRequest = await request.json();
    const { fromAddress, amount, chain, token, message } = body;

    // Validate request
    if (!fromAddress || !amount || !chain) {
      return NextResponse.json(
        {
          error: "Missing required fields: fromAddress, amount, chain",
        },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    // Validate from address
    if (!fromAddress.startsWith("0x") || fromAddress.length !== 42) {
      return NextResponse.json(
        { error: "Invalid fromAddress format" },
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

    // Resolve agent's WDK wallet address for this chain
    const agentAddress = await resolveAgentAddress(chain);
    if (!agentAddress) {
      return NextResponse.json(
        { error: "Agent wallet not available. WDK initialization failed." },
        { status: 503, headers: corsHeaders(origin) },
      );
    }

    const tipId = `tip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tipToken = token || (chain === "celo" ? "cUSD" : "USDT");

    // Record the tip in the ledger
    // The actual token transfer happens client-side via wagmi/viem.
    // The server confirms the agent wallet is ready to receive.
    const tip = {
      id: tipId,
      from: fromAddress,
      to: agentAddress,
      amount,
      chain,
      token: tipToken,
      timestamp: Date.now(),
      message,
      status: "pending" as const,
    };

    tipLedger.push(tip);

    console.log(`[AgentTip] Tip recorded: ${amount} ${tipToken} on ${chain}`, {
      from: fromAddress.slice(0, 6) + "..." + fromAddress.slice(-4),
      to: agentAddress.slice(0, 6) + "..." + agentAddress.slice(-4),
      message,
    });

    return NextResponse.json(
      {
        success: true,
        tip: {
          id: tipId,
          amount,
          token: tipToken,
          chain,
          toAddress: agentAddress,
          status: "pending",
          timestamp: tip.timestamp,
        },
        agentResponse: message
          ? `Thank you for the ${amount} ${tipToken} tip! Your message: "${message}" I'll keep styling!`
          : `Thank you for the ${amount} ${tipToken} tip! Your support helps me keep styling!`,
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

  try {
    // Resolve agent WDK addresses for display
    const wallet = await getAgentWallet();
    const addresses = await wallet.getAddresses();

    // Return tip statistics + agent wallet addresses
    const totalTips = tipLedger.reduce(
      (sum, tip) => sum + parseFloat(tip.amount),
      0,
    );
    const tipCount = tipLedger.length;

    return NextResponse.json(
      {
        agent: {
          name: "OnPoint AI Stylist",
          addresses,
          supportedChains: Object.keys(addresses),
        },
        totalTips: totalTips.toString(),
        tipCount,
        recentTips: tipLedger.slice(-10).reverse(),
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Tip GET error:", error);
    return NextResponse.json(
      { error: "Failed to get tip info" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
