/**
 * SIWE Nonce Generation API
 * 
 * Generates a cryptographically secure nonce for SIWE authentication.
 * Nonces are single-use and expire after 10 minutes.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateNonce } from "../../../../middleware/agent-auth";
import { corsHeaders } from "../../ai/_utils/http";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    const nonce = await generateNonce();

    return NextResponse.json(
      { nonce },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Nonce generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate nonce" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get("origin") ?? undefined),
  });
}
