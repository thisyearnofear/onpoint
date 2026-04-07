import { NextRequest, NextResponse } from "next/server";
import { extractAuth } from "../../../../middleware/agent-auth";
import { CalendarTool } from "../../../../lib/agent-tools/calendar-tool";
import type { CalendarEvent } from "../../../../lib/agent-tools/calendar-tool";

/**
 * POST /api/agent/schedule-event
 *
 * Agent endpoint to schedule fashion events in user's calendar.
 * Demonstrates Auth0 Token Vault integration.
 *
 * Flow:
 * 1. Agent authenticates (SIWE or Auth0)
 * 2. Agent requests to schedule event
 * 3. Token Vault fetches Google Calendar token
 * 4. Event is created in user's calendar
 * 5. Agent never sees the OAuth token
 *
 * Body:
 * - summary: Event title (e.g., "Try-on appointment at Zara")
 * - description: Event details
 * - start: ISO 8601 datetime
 * - end: ISO 8601 datetime
 * - location: Optional location
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the agent
    const auth = await extractAuth(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized", details: "Authentication required" },
        { status: 401 },
      );
    }

    // 2. Parse the event details
    const body = await request.json();
    const event: CalendarEvent = {
      summary: body.summary,
      description: body.description,
      start: body.start,
      end: body.end,
      location: body.location,
    };

    // Validate required fields
    if (!event.summary || !event.start || !event.end) {
      return NextResponse.json(
        { error: "Missing required fields: summary, start, end" },
        { status: 400 },
      );
    }

    // 3. Check if user has connected Google Calendar
    // If not, return a helpful error with connection URL
    const result = await CalendarTool.scheduleEvent(auth, event);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          requiresConnection: result.error?.includes("connect"),
          connectionUrl:
            "/api/auth/connect?connection=google-oauth2&scope=https://www.googleapis.com/auth/calendar.events",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Event scheduled successfully",
      eventId: result.eventId,
      event: {
        summary: event.summary,
        start: event.start,
        end: event.end,
      },
    });
  } catch (error: any) {
    console.error("[ScheduleEvent] Error:", error);
    return NextResponse.json(
      { error: "Failed to schedule event", details: error.message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/agent/schedule-event
 *
 * Get upcoming events to check availability.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await extractAuth(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysAhead = parseInt(searchParams.get("days") || "7");

    const result = await CalendarTool.getUpcomingEvents(auth, daysAhead);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          requiresConnection: result.error?.includes("connect"),
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      events: result.events,
      daysAhead,
    });
  } catch (error: any) {
    console.error("[GetEvents] Error:", error);
    return NextResponse.json(
      { error: "Failed to get events", details: error.message },
      { status: 500 },
    );
  }
}
