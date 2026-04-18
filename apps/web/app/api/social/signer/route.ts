import { NextRequest, NextResponse } from "next/server";
import { NeynarSocialUtils } from "../../../../lib/utils/neynar";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import { logger } from "../../../../lib/utils/logger";

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    try {
      const signer = await NeynarSocialUtils.createManagedSigner();
      if (!signer) {
        return NextResponse.json(
          { error: "Failed to create signer" },
          { status: 500 },
        );
      }
      return NextResponse.json({ signer });
    } catch (error) {
      logger.error("Signer creation API error", { component: "signer" }, error);
      return NextResponse.json(
        { error: "Failed to create signer" },
        { status: 500 },
      );
    }
  })(request);
}
