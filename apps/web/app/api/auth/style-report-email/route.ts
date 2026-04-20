import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";
import { sendStyleReportEmail } from "../../../../lib/services/email";
import { redisGet, redisSetEx } from "../../../../lib/utils/redis-helpers";

/**
 * POST /api/auth/style-report-email
 *
 * Sends a style report email after a session. Rate-limited to 1 per user per day.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ sent: false });
    }

    // Max 1 style report email per user per day
    const key = `style-report-sent:${session.user.sub}`;
    const alreadySent = await redisGet(key);
    if (alreadySent) {
      return NextResponse.json({ sent: false, reason: "daily_limit" });
    }

    const { score, takeaways } = await request.json();
    if (!score || !takeaways?.length) {
      return NextResponse.json({ sent: false });
    }

    await sendStyleReportEmail(
      session.user.email,
      session.user.name,
      score,
      takeaways,
    );
    await redisSetEx(key, true, 86400); // 24h cooldown

    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ sent: false });
  }
}
