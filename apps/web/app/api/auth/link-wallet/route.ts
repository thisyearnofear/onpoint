import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { auth0 } from "../../../../lib/auth0";
import {
  linkAuth0ToWallet,
  verifyAndConsumeNonce,
} from "../../../../middleware/agent-auth";
import { logger } from "../../../../lib/utils/logger";
import {
  rateLimit,
  RateLimits,
  getClientId,
} from "../../../../lib/utils/rate-limit";

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

    const { message, signature } = await request.json();
    if (!message || !signature) {
      return NextResponse.json(
        { error: "Missing signed wallet link payload" },
        { status: 400 },
      );
    }

    const siweMessage = new SiweMessage(message);
    const expectedDomain = request.headers.get("host") ?? undefined;
    const fields = await siweMessage.verify({
      signature,
      domain: expectedDomain,
    });

    if (!fields.success) {
      return NextResponse.json(
        { error: "Invalid wallet signature" },
        { status: 401 },
      );
    }

    const nonceValid = await verifyAndConsumeNonce(siweMessage.nonce);
    if (!nonceValid) {
      return NextResponse.json(
        { error: "Invalid or expired nonce" },
        { status: 401 },
      );
    }

    if (
      siweMessage.expirationTime &&
      new Date(siweMessage.expirationTime) < new Date()
    ) {
      return NextResponse.json({ error: "Message expired" }, { status: 401 });
    }

    const walletAddress = siweMessage.address;
    await linkAuth0ToWallet(session.user.sub, walletAddress);

    logger.info("Linked Auth0 to wallet", {
      component: "auth",
      auth0Id: session.user.sub,
      wallet: walletAddress.slice(0, 8) + "…",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to link wallet", { component: "auth" }, error);
    return NextResponse.json(
      { error: "Failed to link wallet" },
      { status: 500 },
    );
  }
}
