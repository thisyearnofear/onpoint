import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../lib/utils/logger";
import { readNotifications } from "../../../../lib/utils/notifications";

export { OPTIONS } from "../../ai/_utils/http";

function getServiceKey(): string | undefined {
  return process.env.SERVICE_API_KEY;
}

function cleanText(value: unknown, max = 64): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

function cleanSlug(value: unknown): string | null {
  const clean = cleanText(value, 64)?.toLowerCase() || null;
  if (!clean || !/^[a-z0-9-]{2,64}$/.test(clean)) return null;
  return clean;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const serviceKey = getServiceKey();
  const providedKey = request.headers.get("x-service-key");
  if (!serviceKey || providedKey !== serviceKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const curatorSlug = cleanSlug(
    new URL(request.url).searchParams.get("curatorSlug"),
  );
  if (!curatorSlug) {
    return NextResponse.json(
      { error: "Valid curatorSlug is required" },
      { status: 400 },
    );
  }

  try {
    const notifications = await readNotifications(curatorSlug);
    const unread = notifications.filter((n) => n.read === false).length;
    return NextResponse.json({ notifications, total: notifications.length, unread });
  } catch (error) {
    logger.error(
      "Curator notification read error",
      { component: "curator-notifications", curatorSlug },
      error,
    );
    return NextResponse.json(
      { error: "Failed to read notifications" },
      { status: 500 },
    );
  }
}
