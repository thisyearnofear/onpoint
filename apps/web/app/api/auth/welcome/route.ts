import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";
import { sendWelcomeEmail } from "../../../../lib/services/email";
import { redisGet, redisSetEx } from "../../../../lib/utils/redis-helpers";

/**
 * POST /api/auth/welcome
 *
 * Called once after first sign-in. Sends welcome email if not already sent.
 * Idempotent — safe to call multiple times.
 */
export async function POST() {
  try {
    const session = await auth0.getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ sent: false });
    }

    const key = `welcome-sent:${session.user.sub}`;
    const alreadySent = await redisGet(key);
    if (alreadySent) {
      return NextResponse.json({ sent: false, reason: "already_sent" });
    }

    await sendWelcomeEmail(session.user.email, session.user.name);
    await redisSetEx(key, true, 86400 * 365);

    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ sent: false });
  }
}
