import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import {
  getAgentIdentity,
  getAllReceipts,
  getSessionReceipts,
  getOnChainReceipts,
  getReceipt,
} from "../../../../lib/services/agent-registry";

/**
 * GET /api/agent/receipts
 *
 * Returns ERC-8004 receipts for the OnPoint agent.
 * Query params:
 *   - sessionId: filter by session
 *   - onchain: only return receipts with txHash
 *   - limit: max results (default 50)
 *   - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  const url = new URL(request.url);

  try {
    const sessionId = url.searchParams.get("sessionId");
    const onchain = url.searchParams.get("onchain") === "true";
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const receiptId = url.searchParams.get("id");

    // Get agent identity
    const identity = getAgentIdentity();

    // Get specific receipt by ID
    if (receiptId) {
      const receipt = getReceipt(receiptId);
      if (!receipt) {
        return NextResponse.json(
          { error: "Receipt not found" },
          { status: 404, headers: corsHeaders(origin) },
        );
      }
      return NextResponse.json(
        { identity, receipt },
        { headers: corsHeaders(origin) },
      );
    }

    // Get receipts
    let receipts;
    let total;

    if (sessionId) {
      receipts = getSessionReceipts(sessionId);
      total = receipts.length;
    } else if (onchain) {
      receipts = getOnChainReceipts();
      total = receipts.length;
    } else {
      const result = getAllReceipts({ limit, offset });
      receipts = result.receipts;
      total = result.total;
    }

    return NextResponse.json(
      {
        identity,
        receipts,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + receipts.length < total,
        },
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("[ReceiptsAPI] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
