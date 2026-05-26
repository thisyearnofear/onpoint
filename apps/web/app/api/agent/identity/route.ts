/**
 * GET /api/agent/identity
 *
 * Returns the unified agent identity for Proof of Ship judges.
 * Combines ERC-8004 and Self Protocol registrations.
 *
 * Authentication: None required (public read for transparency)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUnifiedAgentIdentity } from "../../../../lib/services/self-protocol";
import { getAgentIdentity } from "../../../../lib/services/agent-registry";
import { corsHeaders } from "../../ai/_utils/http";

export { OPTIONS } from "../../ai/_utils/http";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    // 1. Load ERC-8004 identity (from agent-registry.ts)
    const erc8004Identity = await getAgentIdentity();

    // 2. Load / create Self Protocol identity
    const unified = await getUnifiedAgentIdentity(
      erc8004Identity.walletAddress,
      erc8004Identity.agentId,
    );

    return NextResponse.json(
      {
        agent: {
          name: "OnPoint AI Stylist",
          agentId: erc8004Identity.agentId,
          walletAddress: erc8004Identity.walletAddress,
        },
        registrations: {
          erc8004: {
            agentId: unified.erc8004.agentId,
            registryAddress: unified.erc8004.registryAddress,
            registrationTxHash: unified.erc8004.registrationTxHash,
            receiptCount: erc8004Identity.receiptCount,
          },
          self: {
            selfAgentId: unified.self.selfAgentId,
            status: unified.self.status,
            attestationHash: unified.self.attestationHash,
          },
        },
        compliance: {
          erc8004: true,
          selfAgentId: unified.self.status === "verified" || unified.self.status === "pending",
          walletOnchain: true,
        },
        links: {
          erc8004Registry: `https://basescan.org/address/${unified.erc8004.registryAddress}`,
          selfProtocol: "https://self.xyz",
          celoscan: `https://celoscan.io/address/${unified.erc8004.walletAddress}`,
        },
      },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Agent identity error:", error);
    return NextResponse.json(
      { error: "Failed to load agent identity" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
