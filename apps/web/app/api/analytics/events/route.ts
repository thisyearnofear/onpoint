import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
export { OPTIONS } from "../../ai/_utils/http";
import { logger } from "../../../../lib/utils/logger";
import { recordProviderOutcome, recordDeepLinkPersonaSelected, recordDeepLinkPersonaOutcome, recordRetentionEvent } from "../../../../lib/utils/analytics-store";

interface AnalyticsEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
}

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const body = await req.json();
      const events: AnalyticsEvent[] = body.events || [];

      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json(
          { error: "No events provided" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      // Limit batch size
      if (events.length > 100) {
        return NextResponse.json(
          { error: "Too many events (max 100)" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      // Process events
      // In production, you would:
      // 1. Validate each event
      // 2. Store in a database (ClickHouse, BigQuery, etc.)
      // 3. Forward to analytics services (PostHog, Mixpanel, etc.)

      // For now, just log them
      for (const event of events) {
        logger.info("[Analytics Event]", { component: "events", ...{
          event: event.event,
          sessionId: event.sessionId?.slice(0, 8) + "...", // Truncate for privacy
          timestamp: new Date(event.timestamp).toISOString(),
          properties: event.properties,
        } });
      }

      // Persist provider outcome aggregations to Redis (best-effort)
      const outcomeEvents = events.filter(
        (e) => e.event === "virtual_try_on_provider_outcome",
      );
      for (const oe of outcomeEvents) {
        const p = oe.properties || {};
        recordProviderOutcome({
          provider: p.provider as string | undefined,
          imageConditioned: Boolean(p.imageConditioned),
          fallbackReason: p.fallbackReason as string | null | undefined || null,
          latencyMs: p.latencyMs as number | undefined,
          errorClass: p.errorClass as string | null | undefined || null,
          garmentSource: p.garmentSource as string | undefined,
          garmentCategory: p.garmentCategory as string | undefined,
          hasPersonImage: Boolean(p.hasPersonImage),
          hasGarmentImage: Boolean(p.hasGarmentImage),
        });
      }

      // Persist deep-link persona events to Redis (best-effort)
      const dlSelectedEvents = events.filter((e) => e.event === "deep_link_persona_selected");
      for (const ev of dlSelectedEvents) {
        const p = ev.properties || {};
        recordDeepLinkPersonaSelected({
          persona: p.persona as string,
          curatorSlug: p.curatorSlug as string | undefined,
          listingId: p.listingId as string | undefined,
        });
      }

      const dlOutcomeEvents = events.filter((e) => e.event === "deep_link_persona_outcome");
      for (const ev of dlOutcomeEvents) {
        const p = ev.properties || {};
        recordDeepLinkPersonaOutcome({
          persona: p.persona as string,
          curatorSlug: p.curatorSlug as string | undefined,
          completed: Boolean(p.completed),
          durationMs: p.durationMs as number | undefined,
        });
      }

      // Persist retention events to Redis (best-effort)
      const saveEvents = events.filter((e) => e.event === "look_saved");
      for (const ev of saveEvents) {
        const p = ev.properties || {};
        recordRetentionEvent({
          eventType: "look_saved",
          score: p.score as number | undefined,
          persona: p.persona as string | null,
          garmentCategory: p.garmentCategory as string | undefined,
          hasImage: Boolean(p.hasImage),
          source: p.source as string | undefined,
        });
      }

      const openEvents = events.filter((e) => e.event === "style_card_opened");
      for (const ev of openEvents) {
        const p = ev.properties || {};
        recordRetentionEvent({
          eventType: "style_card_opened",
          score: p.score as number | undefined,
          persona: p.persona as string | null,
        });
      }

      const shareEvents = events.filter((e) => e.event === "style_card_share");
      for (const ev of shareEvents) {
        const p = ev.properties || {};
        recordRetentionEvent({
          eventType: "style_card_share",
          method: p.method as "farcaster" | "twitter" | "download" | "copy" | "native_share" | undefined,
          score: p.score as number | undefined,
          persona: p.persona as string | null,
        });
      }

      // Aggregate metrics for key events
      const metrics = {
        provider_selections: events.filter(
          (e) => e.event === "provider_selected",
        ).length,
        sessions_started: events.filter(
          (e) => e.event === "live_session_started",
        ).length,
        sessions_ended: events.filter((e) => e.event === "live_session_ended")
          .length,
        payments_initiated: events.filter(
          (e) => e.event === "payment_initiated",
        ).length,
        payments_completed: events.filter(
          (e) => e.event === "payment_completed",
        ).length,
        virtual_try_on_provider_outcomes: outcomeEvents.length,
        virtual_try_on_provider_errors: events.filter(
          (e) => e.event === "virtual_try_on_provider_error",
        ).length,
        looks_saved: saveEvents.length,
        style_cards_opened: openEvents.length,
        style_card_shares: shareEvents.length,
      };

      return NextResponse.json(
        {
          success: true,
          received: events.length,
          metrics,
        },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Analytics ingestion error", { component: "events" }, error);
      return NextResponse.json(
        { error: "Failed to process analytics events" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}
