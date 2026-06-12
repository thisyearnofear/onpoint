import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { getAgentIdentity } from "../../../../lib/services/agent-registry";
import {
  getUnifiedAgentIdentity,
} from "../../../../lib/services/self-protocol";
import {
  rateLimit,
  RateLimits,
  getClientId,
} from "../../../../lib/utils/rate-limit";
import { logger } from "../../../../lib/utils/logger";
export { OPTIONS } from "../../ai/_utils/http";

const AGENT_WALLET =
  process.env.AGENT_WALLET_ADDRESS ||
  "0x5b33E63440e95289207120B94da78CE22F9D24fB";

const ERC8004_AGENT_ID = 9177;

/**
 * GET /api/agent/attestation
 *
 * Returns the unified agent identity:
 * - ERC-8004 registry (agent ID 9177 on Celo)
 * - Self Protocol attestation (decentralized agent identity)
 * - Receipt count (verifiable onchain actions)
 *
 * Public endpoint — agent identity is meant to be verifiable by anyone.
 * Rate-limited per IP to prevent abuse. The route does not depend on the
 * caller's session, so the auth gate would only produce a 401 for
 * unauthenticated visitors looking at the trust badge.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          ...corsHeaders(request.headers.get("origin") || "*"),
          "X-RateLimit-Limit": rl.limit.toString(),
          "X-RateLimit-Remaining": rl.remaining.toString(),
          "X-RateLimit-Reset": Math.ceil(rl.resetAt / 1000).toString(),
        },
      },
    );
  }

  const origin = request.headers.get("origin") || "*";

  try {
    const [erc8004Identity, unified] = await Promise.all([
      getAgentIdentity(),
      getUnifiedAgentIdentity(AGENT_WALLET, ERC8004_AGENT_ID),
    ]);

    return NextResponse.json(
      {
        erc8004: {
          agentId: erc8004Identity.agentId,
          name: erc8004Identity.name,
          walletAddress: erc8004Identity.walletAddress,
          registryAddress: erc8004Identity.registryAddress,
          registrationTxHash: erc8004Identity.registrationTxHash,
          receiptCount: erc8004Identity.receiptCount,
          registeredAt: erc8004Identity.registeredAt,
          explorerUrl: `https://celoscan.io/address/${erc8004Identity.walletAddress}`,
          registryExplorerUrl: `https://celoscan.io/address/${erc8004Identity.registryAddress}`,
        },
        self: unified.self,
        trust: {
          erc8004Registered: true,
          selfVerified: unified.self.status === "verified",
          receiptCount: erc8004Identity.receiptCount,
          chain: "Celo",
        },
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    logger.error("Attestation fetch failed", { component: "attestation" }, error);
    return NextResponse.json(
      { error: "Failed to fetch attestation" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
