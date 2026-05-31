import { NextRequest, NextResponse } from "next/server";
import { createViewNotification } from "../../../../lib/utils/notifications";

export { OPTIONS } from "../../ai/_utils/http";

function cleanText(value: unknown, max = 80): string | null {
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

/**
 * POST /api/curator/views
 *
 * Called by the CuratorTracker client component when a listing
 * has been visible for a sustained period (high-intent view).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as Record<string, unknown>;

  const curatorSlug = cleanSlug(body.curatorSlug);
  const listingId = cleanText(body.listingId as string, 80);
  const club = cleanText(body.club as string, 60);
  const kitType = cleanText(body.kitType as string, 40);

  if (!curatorSlug || !listingId) {
    return NextResponse.json(
      { error: "curatorSlug and listingId are required" },
      { status: 400 },
    );
  }

  try {
    await createViewNotification({ curatorSlug, listingId, club: club || undefined, kitType: kitType || undefined });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to record view notification" },
      { status: 500 },
    );
  }
}
