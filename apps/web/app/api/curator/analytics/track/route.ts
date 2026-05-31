import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../../lib/utils/logger";
import {
  recordCuratorPageView,
  recordCuratorTryOn,
  recordCuratorBuyClick,
  recordCuratorShare,
  recordCuratorShareVisit,
  recordCuratorLead,
  recordCuratorPurchase,
  recordCuratorHighIntentView,
} from "../../../../../lib/utils/curator-analytics-store";

export { OPTIONS } from "../../../ai/_utils/http";

type TrackEvent =
  | "page_view"
  | "try_on"
  | "buy_click"
  | "share"
  | "share_visit"
  | "lead"
  | "purchase"
  | "high_intent_view";

interface TrackPayload {
  event: TrackEvent;
  curatorSlug?: string;
  shareSourceSlug?: string;
  visitorCuratorSlug?: string;
  attributedCuratorSlug?: string;
}

function cleanSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,64}$/.test(clean)) return null;
  return clean;
}

/**
 * POST /api/curator/analytics/track
 *
 * Client-side tracking endpoint for curator funnel events.
 * Called by CuratorTracker and other client components.
 * No auth required — best-effort analytics collection.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as TrackPayload;

    if (process.env.NODE_ENV === "development") {
      logger.info("Curator analytics track", {
        component: "curator-analytics-track",
        event: body.event,
        curatorSlug: body.curatorSlug,
      });
    }

    switch (body.event) {
      case "page_view": {
        const slug = cleanSlug(body.curatorSlug);
        if (slug) {
          await recordCuratorPageView(slug).catch(() => {});
        }
        break;
      }
      case "try_on": {
        const slug = cleanSlug(body.curatorSlug);
        if (slug) {
          await recordCuratorTryOn(slug).catch(() => {});
        }
        break;
      }
      case "buy_click": {
        const slug = cleanSlug(body.curatorSlug);
        if (slug) {
          await recordCuratorBuyClick(slug).catch(() => {});
        }
        break;
      }
      case "share": {
        const slug = cleanSlug(body.curatorSlug);
        if (slug) {
          await recordCuratorShare(slug).catch(() => {});
        }
        break;
      }
      case "share_visit": {
        const sourceSlug = cleanSlug(body.shareSourceSlug);
        const visitorSlug = cleanSlug(body.visitorCuratorSlug);
        if (sourceSlug) {
          await recordCuratorShareVisit(
            sourceSlug,
            visitorSlug || undefined,
          ).catch(() => {});
        }
        break;
      }
      case "lead": {
        const slug = cleanSlug(body.curatorSlug);
        if (slug) {
          await recordCuratorLead(slug).catch(() => {});
        }
        break;
      }
      case "purchase": {
        const slug = cleanSlug(body.curatorSlug);
        if (slug) {
          await recordCuratorPurchase(
            slug,
            cleanSlug(body.attributedCuratorSlug) || undefined,
          ).catch(() => {});
        }
        break;
      }
      case "high_intent_view": {
        const slug = cleanSlug(body.curatorSlug);
        if (slug) {
          await recordCuratorHighIntentView(slug).catch(() => {});
        }
        break;
      }
      default:
        // Unknown event type — silently ignore
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Analytics tracking is best-effort — never return an error to the client
    logger.warn("Curator analytics track error", { component: "curator-analytics-track" }, error);
    return NextResponse.json({ success: false });
  }
}
