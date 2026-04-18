import { NextRequest, NextResponse } from "next/server";
import { NeynarSocialUtils } from "../../../../lib/utils/neynar";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import { logger } from "../../../../lib/utils/logger";

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    try {
      const { signerUuid, castHash, reaction } = await req.json();
      if (!signerUuid || !castHash || !reaction) {
        return NextResponse.json(
          { error: "signerUuid, castHash and reaction are required" },
          { status: 400 },
        );
      }
      const result = await NeynarSocialUtils.reactToCast(
        signerUuid,
        castHash,
        reaction,
      );
      return NextResponse.json({ ok: true, result });
    } catch (error) {
      logger.error("Reaction API error", { component: "reaction" }, error);
      return NextResponse.json(
        { error: "Failed to publish reaction" },
        { status: 500 },
      );
    }
  })(request);
}
