import { NextRequest, NextResponse } from "next/server";
import { NeynarSocialUtils } from "../../../../lib/utils/neynar";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    try {
      const body = await req.json();
      const { signerUuid, text, embeds, parent } = body;

      if (!signerUuid || !text) {
        return NextResponse.json(
          { error: "signerUuid and text are required" },
          { status: 400 },
        );
      }

      const cast = await NeynarSocialUtils.publishCast(signerUuid, {
        text,
        embeds: embeds?.map((url: string) => ({ url })),
        parent,
      });

      return NextResponse.json({ cast });
    } catch (error) {
      console.error("Cast publish API error:", error);
      return NextResponse.json(
        { error: "Failed to publish cast" },
        { status: 500 },
      );
    }
  })(request);
}
