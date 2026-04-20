import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";
import { linkAuth0ToWallet } from "../../../../middleware/agent-auth";
import { logger } from "../../../../lib/utils/logger";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const session = await auth0.getSession();
    if (!session?.user?.sub) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { walletAddress } = await request.json();
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    await linkAuth0ToWallet(session.user.sub, walletAddress);

    logger.info("Linked Auth0 to wallet", {
      component: "auth",
      auth0Id: session.user.sub,
      wallet: walletAddress.slice(0, 8) + "…",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to link wallet", { component: "auth" }, error);
    return NextResponse.json({ error: "Failed to link wallet" }, { status: 500 });
  }
}
