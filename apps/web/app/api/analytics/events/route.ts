import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";

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
        console.log("[Analytics Event]", {
          event: event.event,
          sessionId: event.sessionId?.slice(0, 8) + "...", // Truncate for privacy
          timestamp: new Date(event.timestamp).toISOString(),
          properties: event.properties,
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
      console.error("Analytics ingestion error:", error);
      return NextResponse.json(
        { error: "Failed to process analytics events" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
